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
  kind: "spk_in" | "usds_out"
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
 * Buyback fills reconstructed from Ethplorer's address transfer history.
 *
 * SPK inbound to the SubDAO Proxy from the Ops Multisig is a buyback landing
 * home. USDS outbound from the SubDAO Proxy to the Ops Multisig is the spend
 * leg funding a future TWAP round. We report them as two aggregate totals
 * plus per-transfer detail — pairing them per-cycle isn't robust because
 * CoW TWAP orders settle asynchronously across days, so a single USDS
 * outflow can span multiple SPK-in transfers and vice versa.
 *
 * Ethplorer's `getAddressHistory` is used instead of raw eth_getLogs because
 * public RPCs reject the wide block range needed to catch the earliest
 * cycles, and the code path that fell back on chunked scans was returning 0
 * fills against ~4 real cycles totaling ~94M SPK on-chain (confirmed via
 * Spark's own "over 100M SPK bought back" announcement on 2026-08-18).
 */
type EthplorerOp = {
  timestamp: number
  transactionHash: string
  value: string
  from: string
  to: string
}

async function ethplorerTransfers(
  addressLower: string,
  tokenLower: string,
  apiKey: string
): Promise<EthplorerOp[]> {
  const url = `https://api.ethplorer.io/getAddressHistory/${addressLower}?apiKey=${apiKey}&type=transfer&token=${tokenLower}&limit=100`
  const res = await fetch(url, { next: { revalidate: 900 } })
  if (!res.ok) throw new Error(`ethplorer ${res.status}`)
  const data = await res.json()
  return (data?.operations || []) as EthplorerOp[]
}

async function fetchBuybackFills(): Promise<BuybackFill[]> {
  const SPK: Address = TREASURY_ASSETS.find((a) => a.symbol === "SPK")!.address
  const USDS: Address = TREASURY_ASSETS.find((a) => a.symbol === "USDS")!.address
  const proxy = SPARK_PROXY.toLowerCase()
  const ops = SPARK_OPS_MULTISIG.toLowerCase()
  const apiKey = process.env.ETHPLORER_API_KEY || "freekey"

  let spkOps: EthplorerOp[]
  let usdsOps: EthplorerOp[]
  try {
    ;[spkOps, usdsOps] = await Promise.all([
      ethplorerTransfers(proxy, SPK.toLowerCase(), apiKey),
      ethplorerTransfers(proxy, USDS.toLowerCase(), apiKey),
    ])
  } catch (e: any) {
    console.error("buyback fills fetch:", e.message)
    return []
  }

  // SPK inbound from Ops Multisig = buyback landing home.
  const spkFills = spkOps
    .filter((op) => op.from?.toLowerCase() === ops && op.to?.toLowerCase() === proxy)
    .map((op) => ({
      timestamp: Number(op.timestamp),
      txHash: op.transactionHash,
      spkBought: Number(formatUnits(BigInt(op.value), 18)),
      usdsSpent: 0,
      effectivePriceUSD: 0,
      kind: "spk_in" as const,
    }))

  // USDS outbound to Ops Multisig = future TWAP funding. Reported as its own
  // fill row so users can see both legs of the flow; the SPK-in rows carry
  // the actual purchase quantity, the USDS-out rows carry the actual spend.
  const usdsFills = usdsOps
    .filter((op) => op.from?.toLowerCase() === proxy && op.to?.toLowerCase() === ops)
    .map((op) => ({
      timestamp: Number(op.timestamp),
      txHash: op.transactionHash,
      spkBought: 0,
      usdsSpent: Number(formatUnits(BigInt(op.value), 18)),
      effectivePriceUSD: 0,
      kind: "usds_out" as const,
    }))

  return [...spkFills, ...usdsFills].sort((a, b) => b.timestamp - a.timestamp)
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
      sources.push("ethplorer address transfers")
      return r
    }),
  ])

  const threshold = currentThreshold()
  const cushionUSD = liveTreasury.totalUSD - threshold.targetUSD
  const cushionMonths =
    threshold.monthlyBudgetUSD > 0 ? cushionUSD / threshold.monthlyBudgetUSD : null

  // Sum each leg independently — SPK-in and USDS-out are two sides of the
  // same buyback flow but they don't land 1:1 per tx (CoW TWAP orders settle
  // asynchronously across days), so pairing per-row would misreport pace.
  const cumulativeSpkBought = fills
    .filter((f) => f.kind === "spk_in")
    .reduce((s, f) => s + f.spkBought, 0)
  const cumulativeUsdsSpent = fills
    .filter((f) => f.kind === "usds_out")
    .reduce((s, f) => s + f.usdsSpent, 0)
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
