import { NextResponse } from "next/server"
import {
  client,
  SPARK_PROXY,
  SPARK_OPS_MULTISIG,
  TREASURY_ASSETS,
} from "@/lib/contracts"
import { currentThreshold, BUYBACK_THRESHOLDS } from "@/lib/spark-config"
import { type Address, parseAbiItem, formatUnits } from "viem"

export const dynamic = "force-dynamic"
export const revalidate = 900 // 15 min — treasury moves in ~monthly cadence
export const maxDuration = 60

interface TreasuryLine {
  symbol: string
  amount: number
  priceUSD: number
  valueUSD: number
  /** Own-token holdings (SPK) are informational only; excluded from the
      spendable-treasury total to match Phoenix Labs' "Total Treasury"
      convention in the monthly proxy-management posts. */
  isSpendable: boolean
}

interface BuybackFill {
  timestamp: number
  txHash: string
  usdsSpent: number
  spkBought: number
  effectivePriceUSD: number
}

interface BuybackResponse {
  treasury: {
    totalUSD: number       // spendable only (excludes SPK own-token)
    spkHeldUSD: number     // SPK sitting in the proxy (from prior buybacks)
    spkHeldAmount: number
    lines: TreasuryLine[]
    asOf: number
  }
  historicalUSD: Array<{ date: number; totalUSD: number }>
  threshold: {
    targetUSD: number
    cushionUSD: number
    cushionMonths: number | null
    standardBuybackRate: number
    monthlyBudgetUSD: number
    effectiveFrom: string
    note?: string
    sourceUrl: string
  }
  buybacks: {
    fills: BuybackFill[]
    cumulativeUsdsSpent: number
    cumulativeSpkBought: number
    avgPriceUSD: number | null
  }
  meta: {
    treasuryAddress: Address
    opsMultisig: Address
    sourcesUsed: string[]
    generatedAt: number
  }
}

const erc20BalanceOfAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const

// SPK Transfer events into the SubDAO proxy = buybacks landing home. Same event
// shape as USDS out from the ops multisig — the fill IS the transfer.
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
)

// ── Price helpers ────────────────────────────────────────────────────────────

/**
 * DefiLlama Coins /prices/current — batched, one call for all tokens we care
 * about. Symbols returned as {"ethereum:0x...": {price, symbol, ...}}.
 */
async function fetchPrices(addresses: Address[]): Promise<Record<string, number>> {
  const keys = addresses.map((a) => `ethereum:${a.toLowerCase()}`).join(",")
  const res = await fetch(`https://coins.llama.fi/prices/current/${keys}`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Coins API ${res.status}`)
  const data = await res.json()
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries<any>(data.coins || {})) {
    const addr = k.split(":")[1]?.toLowerCase()
    if (addr) out[addr] = v.price
  }
  return out
}

// ── Treasury ─────────────────────────────────────────────────────────────────

async function fetchTreasuryLive(): Promise<{
  totalUSD: number
  spkHeldUSD: number
  spkHeldAmount: number
  lines: TreasuryLine[]
}> {
  const balances = await client.multicall({
    contracts: TREASURY_ASSETS.map((asset) => ({
      address: asset.address,
      abi: erc20BalanceOfAbi,
      functionName: "balanceOf" as const,
      args: [SPARK_PROXY] as const,
    })),
    allowFailure: true,
  })

  const prices = await fetchPrices(TREASURY_ASSETS.map((a) => a.address))

  const lines: TreasuryLine[] = []
  for (let i = 0; i < TREASURY_ASSETS.length; i++) {
    const asset = TREASURY_ASSETS[i]
    const bal = balances[i]
    if (bal.status !== "success") continue
    const amount = Number(formatUnits(bal.result as bigint, asset.decimals))
    const priceUSD = prices[asset.address.toLowerCase()] ?? 0
    lines.push({
      symbol: asset.symbol,
      amount,
      priceUSD,
      valueUSD: amount * priceUSD,
      isSpendable: asset.symbol !== "SPK",
    })
  }

  const spkLine = lines.find((l) => l.symbol === "SPK")
  const totalUSD = lines
    .filter((l) => l.isSpendable)
    .reduce((s, l) => s + l.valueUSD, 0)

  return {
    totalUSD,
    spkHeldUSD: spkLine?.valueUSD ?? 0,
    spkHeldAmount: spkLine?.amount ?? 0,
    lines,
  }
}

async function fetchTreasuryHistorical(): Promise<
  Array<{ date: number; totalUSD: number }>
> {
  // DefiLlama treasury endpoint carries a daily "tokensInUsd" series across all
  // tracked treasury assets. It's the same series that shows in Sam's chart —
  // use it for the historical line so we don't have to run a per-day archival
  // scan on our own RPC.
  try {
    const res = await fetch("https://api.llama.fi/treasury/spark", {
      next: { revalidate: 900 },
    })
    if (!res.ok) throw new Error(`treasury ${res.status}`)
    const data = await res.json()
    const series = data?.chainTvls?.Ethereum?.tokensInUsd
    if (!Array.isArray(series)) return []
    return series
      .map((p: any) => ({
        date: p.date as number,
        totalUSD: Object.values<number>(p.tokens || {}).reduce(
          (s, v) => s + (typeof v === "number" ? v : 0),
          0
        ),
      }))
      .filter((p) => p.totalUSD > 0)
      .slice(-365)
  } catch (e: any) {
    console.error("treasury historical:", e.message)
    return []
  }
}

// ── Buyback fills ────────────────────────────────────────────────────────────

/**
 * SPK Transfers where `to = SPARK_PROXY` and `from = SPARK_OPS_MULTISIG` are
 * completed buybacks landing home. Pairing them with the corresponding USDS
 * Transfer where `from = SPARK_PROXY` and `to = SPARK_OPS_MULTISIG` (same tx
 * or near-by block) gives us the spend leg.
 *
 * Cheaper than the CoW orderbook API for a first version and doesn't require
 * an extra auth flow. If per-fill precision matters later we can layer CoW's
 * settlement data in.
 */
async function fetchBuybackFills(): Promise<BuybackFill[]> {
  const currentBlock = await client.getBlockNumber()
  // Buybacks resumed 2026-08-15 per Sam's tweet; go back ~1yr of history to
  // cover the initial launch cycles too. Chunked to keep the free RPCs happy.
  const START_BLOCK = currentBlock - 2_500_000n
  const CHUNK = 500_000n

  const SPK: Address = TREASURY_ASSETS.find((a) => a.symbol === "SPK")!.address
  const USDS: Address = TREASURY_ASSETS.find((a) => a.symbol === "USDS")!.address

  const spkLogs: any[] = []
  const usdsLogs: any[] = []

  for (let from = START_BLOCK; from <= currentBlock; from += CHUNK) {
    const to = from + CHUNK - 1n > currentBlock ? currentBlock : from + CHUNK - 1n
    try {
      const [spkChunk, usdsChunk] = await Promise.all([
        client.getLogs({
          address: SPK,
          event: transferEvent,
          args: { from: SPARK_OPS_MULTISIG, to: SPARK_PROXY },
          fromBlock: from,
          toBlock: to,
        }),
        client.getLogs({
          address: USDS,
          event: transferEvent,
          args: { from: SPARK_PROXY, to: SPARK_OPS_MULTISIG },
          fromBlock: from,
          toBlock: to,
        }),
      ])
      spkLogs.push(...spkChunk)
      usdsLogs.push(...usdsChunk)
    } catch (e: any) {
      console.error(`buyback logs [${from}..${to}]:`, e.message)
    }
  }

  // Timestamp lookup — batch by unique block.
  const uniqueBlocks = Array.from(
    new Set([...spkLogs, ...usdsLogs].map((l) => l.blockNumber))
  )
  const tsByBlock = new Map<bigint, number>()
  for (const bn of uniqueBlocks) {
    try {
      const b = await client.getBlock({ blockNumber: bn })
      tsByBlock.set(bn, Number(b.timestamp))
    } catch {
      /* skip */
    }
  }

  // Pair SPK-in and USDS-out. Cycles are typically minutes apart; matching by
  // day is loose enough to survive CoW's async settlement and tight enough to
  // avoid conflating multiple cycles.
  const buys: BuybackFill[] = []
  const consumedUsds = new Set<number>()
  for (const spk of spkLogs) {
    const spkTs = tsByBlock.get(spk.blockNumber) ?? 0
    const spkDay = Math.floor(spkTs / 86400)
    const usdsMatchIdx = usdsLogs.findIndex((u, i) => {
      if (consumedUsds.has(i)) return false
      const ts = tsByBlock.get(u.blockNumber) ?? 0
      return Math.floor(ts / 86400) === spkDay
    })
    const usds = usdsMatchIdx >= 0 ? usdsLogs[usdsMatchIdx] : null
    if (usdsMatchIdx >= 0) consumedUsds.add(usdsMatchIdx)

    const spkBought = Number(formatUnits(spk.args.value as bigint, 18))
    const usdsSpent = usds ? Number(formatUnits(usds.args.value as bigint, 18)) : 0
    buys.push({
      timestamp: spkTs,
      txHash: spk.transactionHash,
      usdsSpent,
      spkBought,
      effectivePriceUSD: usdsSpent > 0 && spkBought > 0 ? usdsSpent / spkBought : 0,
    })
  }

  return buys.sort((a, b) => b.timestamp - a.timestamp)
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const started = Date.now()
  const sources: string[] = []
  const [liveTreasury, historical, fills] = await Promise.all([
    fetchTreasuryLive().then((r) => {
      sources.push("on-chain balanceOf")
      return r
    }),
    fetchTreasuryHistorical().then((r) => {
      if (r.length) sources.push("api.llama.fi/treasury/spark")
      return r
    }),
    fetchBuybackFills().then((r) => {
      sources.push("eth_getLogs Transfer")
      return r
    }),
  ])

  const threshold = currentThreshold()
  const cushionUSD = liveTreasury.totalUSD - threshold.targetUSD
  const cushionMonths =
    threshold.monthlyBudgetUSD > 0 ? cushionUSD / threshold.monthlyBudgetUSD : null

  const cumulativeUsdsSpent = fills.reduce((s, f) => s + f.usdsSpent, 0)
  const cumulativeSpkBought = fills.reduce((s, f) => s + f.spkBought, 0)
  const avgPriceUSD =
    cumulativeSpkBought > 0 ? cumulativeUsdsSpent / cumulativeSpkBought : null

  const response: BuybackResponse = {
    treasury: {
      totalUSD: liveTreasury.totalUSD,
      spkHeldUSD: liveTreasury.spkHeldUSD,
      spkHeldAmount: liveTreasury.spkHeldAmount,
      lines: liveTreasury.lines,
      asOf: Math.floor(Date.now() / 1000),
    },
    historicalUSD: historical,
    threshold: {
      targetUSD: threshold.targetUSD,
      cushionUSD,
      cushionMonths,
      standardBuybackRate: threshold.standardBuybackRate,
      monthlyBudgetUSD: threshold.monthlyBudgetUSD,
      effectiveFrom: threshold.effectiveFrom,
      note: threshold.note,
      sourceUrl: threshold.sourceUrl,
    },
    buybacks: {
      fills,
      cumulativeUsdsSpent,
      cumulativeSpkBought,
      avgPriceUSD,
    },
    meta: {
      treasuryAddress: SPARK_PROXY,
      opsMultisig: SPARK_OPS_MULTISIG,
      sourcesUsed: sources,
      generatedAt: started,
    },
  }

  return NextResponse.json(response)
}
