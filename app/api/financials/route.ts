import { NextResponse } from "next/server"
import {
  client,
  POOL,
  POOL_ADDRESSES_PROVIDER,
  poolAddressesProviderAbi,
  poolDataProviderAbi,
  oracleAbi,
  USDS_TOKEN,
  SPARK_PROXY,
} from "@/lib/contracts"
import { type Address, parseAbiItem } from "viem"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
// Bundled baseline snapshot for Distribution Rewards. Vercel serverless
// filesystems are ephemeral, so we ship the last-known scan result at build
// time. Refresh with the same npm script that regenerates the wallets baseline.
import distributionRewardsBaseline from "@/data/distribution-rewards-baseline.json"

export const dynamic = "force-dynamic"
// Vercel serverless timeout in seconds. 60s covers cold-start scans of the
// flashloan, liquidation, and distribution-reward event logs.
export const maxDuration = 60

const FLASH_CACHE_FILE = join(process.cwd(), ".flashloan-cache.json")
const LIQ_CACHE_FILE = join(process.cwd(), ".liquidation-cache.json")
const DIST_CACHE_FILE = join(process.cwd(), ".distribution-rewards-cache.json")
const SCAN_CHUNK = 10000n
// Distribution Rewards launched with the Sept 18, 2025 spell (~block 23,300,000).
// Scan a few weeks before that to catch any pre-launch pilot mints too.
const DIST_MIN_BLOCK = 23_200_000n
// Reasonable per-settlement bounds. Sky ecosystem mints (SLL keeper, PSM top-ups)
// are usually well outside this band ($20M-$400M keeper mints, tiny dust below).
const DIST_MIN_USDS = 250_000
const DIST_MAX_USDS = 15_000_000
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

let resultCache: any = null
let resultCacheTime = 0
const CACHE_TTL = 1800_000 // 30 min
let scanningInProgress = false
let distScanningInProgress = false

// ---------- DefiLlama helpers ----------
async function fetchDefiLlamaFees(
  slug: string,
  dataType: string
): Promise<Array<[number, number]>> {
  const res = await fetch(
    `https://api.llama.fi/summary/fees/${slug}?dataType=${dataType}`,
    { cache: "no-store" }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.totalDataChart || []
}

// ---------- Token info ----------
async function getTokenInfo(): Promise<{
  symbolMap: Record<string, string>
  decimalsMap: Record<string, number>
  addresses: Address[]
}> {
  const dataProviderAddr = (await client.readContract({
    address: POOL_ADDRESSES_PROVIDER,
    abi: poolAddressesProviderAbi,
    functionName: "getPoolDataProvider",
  })) as Address

  const tokens = (await client.readContract({
    address: dataProviderAddr,
    abi: poolDataProviderAbi,
    functionName: "getAllReservesTokens",
  })) as Array<{ symbol: string; tokenAddress: Address }>

  const configCalls = tokens.map((t) => ({
    address: dataProviderAddr,
    abi: poolDataProviderAbi,
    functionName: "getReserveConfigurationData" as const,
    args: [t.tokenAddress],
  }))
  const configs = await client.multicall({ contracts: configCalls })

  const symbolMap: Record<string, string> = {}
  const decimalsMap: Record<string, number> = {}
  const addresses: Address[] = []

  for (let i = 0; i < tokens.length; i++) {
    const addr = tokens[i].tokenAddress.toLowerCase()
    symbolMap[addr] = tokens[i].symbol
    decimalsMap[addr] = Number((configs[i].result as any)?.[0] ?? 18)
    addresses.push(tokens[i].tokenAddress)
  }
  return { symbolMap, decimalsMap, addresses }
}

async function getPriceMap(
  addresses: Address[]
): Promise<Record<string, number>> {
  const oracleAddr = (await client.readContract({
    address: POOL_ADDRESSES_PROVIDER,
    abi: poolAddressesProviderAbi,
    functionName: "getPriceOracle",
  })) as Address

  const prices = (await client.readContract({
    address: oracleAddr,
    abi: oracleAbi,
    functionName: "getAssetsPrices",
    args: [addresses],
  })) as bigint[]

  const map: Record<string, number> = {}
  for (let i = 0; i < addresses.length; i++) {
    map[addresses[i].toLowerCase()] = Number(prices[i]) / 1e8
  }
  return map
}

// ---------- Flash loan background scanning ----------
function loadFlashCache(): { lastBlock: string; events: any[] } {
  if (existsSync(FLASH_CACHE_FILE)) {
    try {
      return JSON.parse(readFileSync(FLASH_CACHE_FILE, "utf-8"))
    } catch {}
  }
  return { lastBlock: "0", events: [] }
}

async function scanFlashLoansBackground() {
  if (scanningInProgress) return
  scanningInProgress = true

  try {
    const cache = loadFlashCache()
    const currentBlock = await client.getBlockNumber()
    const lastScanned = BigInt(cache.lastBlock || "0")
    const minBlock = currentBlock - 2000000n
    const startBlock = lastScanned > minBlock ? lastScanned + 1n : minBlock

    if (startBlock >= currentBlock) {
      scanningInProgress = false
      return
    }

    const flashEvent = parseAbiItem(
      "event FlashLoan(address indexed target, address initiator, address indexed asset, uint256 amount, uint8 interestRateMode, uint256 premium, uint16 indexed referralCode)"
    )

    const newEvents: any[] = []
    for (let from = startBlock; from <= currentBlock; from += SCAN_CHUNK) {
      const to =
        from + SCAN_CHUNK - 1n > currentBlock
          ? currentBlock
          : from + SCAN_CHUNK - 1n
      try {
        const logs = await client.getLogs({
          address: POOL,
          event: flashEvent,
          fromBlock: from,
          toBlock: to,
        })
        for (const log of logs) {
          newEvents.push({
            asset: (log.args as any).asset?.toLowerCase(),
            premium: (log.args as any).premium?.toString(),
            amount: (log.args as any).amount?.toString(),
            blockNumber: log.blockNumber?.toString(),
          })
        }
      } catch (err: any) {
        console.error(
          `Flash scan chunk ${from}-${to} failed:`,
          err.message?.slice(0, 100)
        )
      }
    }

    const allEvents = [...cache.events, ...newEvents]
    try {
      writeFileSync(
        FLASH_CACHE_FILE,
        JSON.stringify({
          lastBlock: currentBlock.toString(),
          events: allEvents,
        })
      )
    } catch {}
  } catch (err: any) {
    console.error("Flash scan error:", err.message?.slice(0, 100))
  } finally {
    scanningInProgress = false
  }
}

// ---------- Distribution Rewards scanning ----------
// Sky pays Spark monthly Distribution Rewards as a USDS mint from MCD_PAUSE_PROXY
// (via executive spell Cast) to SPARK_PROXY. Detected as USDS Transfer(0x0 -> SPARK_PROXY)
// where the transaction's tx.from is the Pause Proxy.
interface DistEvent {
  amount: string // wei, 18 decimals
  blockNumber: string
  timestamp: number // unix seconds
  txHash: string
}

function loadDistCache(): { lastBlock: string; events: DistEvent[] } {
  if (existsSync(DIST_CACHE_FILE)) {
    try {
      return JSON.parse(readFileSync(DIST_CACHE_FILE, "utf-8"))
    } catch {}
  }
  // Fallback to build-bundled baseline for Vercel cold starts.
  return distributionRewardsBaseline as { lastBlock: string; events: DistEvent[] }
}

async function scanDistributionRewardsBackground() {
  if (distScanningInProgress) return
  distScanningInProgress = true

  try {
    const cache = loadDistCache()
    const currentBlock = await client.getBlockNumber()
    const lastScanned = BigInt(cache.lastBlock || "0")
    const startBlock =
      lastScanned > DIST_MIN_BLOCK ? lastScanned + 1n : DIST_MIN_BLOCK

    if (startBlock >= currentBlock) {
      distScanningInProgress = false
      return
    }

    const transferEvent = parseAbiItem(
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    )

    // Single getLogs call for the whole range. mevblocker (first in fallback)
    // accepts multi-million-block queries and Distribution Reward mints are
    // sparse (2-3/month), so there's nothing to chunk.
    const logs = await client.getLogs({
      address: USDS_TOKEN,
      event: transferEvent,
      args: {
        to: SPARK_PROXY,
        // Distribution Rewards are USDS *mints* (from = 0x0), executed
        // internally by the Sky executive spell via the Pause Proxy.
        // Non-mint transfers (from an SLL keeper contract etc.) are not rewards.
        from: ZERO_ADDRESS,
      },
      fromBlock: startBlock,
      toBlock: currentBlock,
    })

    // Enrich each candidate with a block timestamp for calendar placement, and
    // apply the amount-bounds heuristic to reject SLL keeper mints (which are
    // orders of magnitude larger) and dust operations.
    const enriched = await Promise.all(
      logs.map(async (log) => {
        try {
          const amountWei = BigInt((log.args as any).value)
          const amountUsd = Number(amountWei) / 1e18
          if (amountUsd < DIST_MIN_USDS || amountUsd > DIST_MAX_USDS) {
            return null
          }
          const block = await client.getBlock({ blockNumber: log.blockNumber! })
          return {
            amount: amountWei.toString(),
            blockNumber: log.blockNumber!.toString(),
            timestamp: Number(block.timestamp),
            txHash: log.transactionHash!,
          } as DistEvent
        } catch {
          return null
        }
      })
    )

    const newEvents = enriched.filter((e): e is DistEvent => e !== null)
    const allEvents = [...cache.events, ...newEvents]

    try {
      writeFileSync(
        DIST_CACHE_FILE,
        JSON.stringify({
          lastBlock: currentBlock.toString(),
          events: allEvents,
        })
      )
    } catch {}
  } catch (err: any) {
    console.error("Dist scan error:", err.message?.slice(0, 100))
  } finally {
    distScanningInProgress = false
  }
}

// ---------- Build daily fee breakdown ----------
function dayTs(ts: number): number {
  const d = new Date(ts * 1000)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime() / 1000
}

function computeFlashFees(
  currentBlock: number,
  decimalsMap: Record<string, number>,
  priceMap: Record<string, number>
): Map<number, number> {
  const cache = loadFlashCache()
  const nowTs = Math.floor(Date.now() / 1000)
  const map = new Map<number, number>()

  for (const ev of cache.events) {
    const decimals = decimalsMap[ev.asset] ?? 18
    const price = priceMap[ev.asset] ?? 0
    const premiumUSD =
      (Number(BigInt(ev.premium)) / Math.pow(10, decimals)) * price

    const blockNum = Number(BigInt(ev.blockNumber))
    const blockAge = currentBlock - blockNum
    const approxTs = nowTs - blockAge * 2
    const key = dayTs(approxTs)

    map.set(key, (map.get(key) || 0) + premiumUSD)
  }
  return map
}

// Rate-accrual approximation for Distribution Rewards, matching the Blockworks
// Research methodology.
//
// Per the Sky Agent Framework spec, Distribution Rewards accrue at ~20 bps/yr
// base + up to +30 bps/yr boost on TAGGED USDS balance (USDS held via Spark-
// referred products: spUSDT / sUSDS / stakedUSDS / etc). Settlement is ONCE per
// Monthly Settlement Cycle as a USDS mint from the Sky Pause Proxy.
//
// The previous implementation amortized each on-chain mint across only the
// days between it and the prior mint. That produced two failure modes:
//   1. Backlog settlements spike the month they land. Sam MacPherson noted on
//      2026-08-15 that a multi-month backlog arrived in July 2026 — attributing
//      that lump to only the July days pushed our July DR to $3.10M vs
//      Blockworks' $1.62M.
//   2. Days after the latest mint carried forward at the last per-day rate,
//      which is whatever the last cycle happened to spread to — including
//      backlog spike rates.
//
// New approach: distribute total cumulative mints evenly across every day from
// program launch (Sept 1, 2025) to today. Individual mint-date spikes go away;
// monthly totals converge on the rate-accrual definition that Blockworks uses.
// A future refinement can weight by per-product tagged USDS balance for month-
// level accuracy, but the flat-rate estimate already collapses the July gap.
function computeDistributionRewards(): Map<number, number> {
  const map = new Map<number, number>()
  const cache = loadDistCache()
  if (cache.events.length === 0) return map

  const totalUSD = cache.events.reduce(
    (sum, ev) => sum + Number(BigInt(ev.amount)) / 1e18,
    0
  )
  if (totalUSD <= 0) return map

  const ANCHOR_TS = Math.floor(new Date("2025-09-01T00:00:00Z").getTime() / 1000)
  const now = Math.floor(Date.now() / 1000)
  const daysElapsed = Math.max(1, Math.round((now - ANCHOR_TS) / 86400))
  const dailyRate = totalUSD / daysElapsed

  const startDay = dayTs(ANCHOR_TS)
  const todayDay = dayTs(now)
  for (let d = startDay; d <= todayDay; d += 86400) {
    map.set(d, dailyRate)
  }
  return map
}

function computeLiqFees(
  currentBlock: number,
  decimalsMap: Record<string, number>,
  priceMap: Record<string, number>
): Map<number, number> {
  const map = new Map<number, number>()
  if (!existsSync(LIQ_CACHE_FILE)) return map

  try {
    const raw = JSON.parse(readFileSync(LIQ_CACHE_FILE, "utf-8"))
    const events = raw.events || []
    const nowTs = Math.floor(Date.now() / 1000)

    for (const ev of events) {
      const collAddr = (ev.collateralAsset || "").toLowerCase()
      const debtAddr = (ev.debtAsset || "").toLowerCase()
      const collDecimals = decimalsMap[collAddr] ?? 18
      const debtDecimals = decimalsMap[debtAddr] ?? 18
      const collPrice = priceMap[collAddr] ?? 0
      const debtPrice = priceMap[debtAddr] ?? 0

      const collateralUSD =
        (Number(BigInt(ev.liquidatedCollateralAmount || "0")) /
          Math.pow(10, collDecimals)) *
        collPrice
      const debtUSD =
        (Number(BigInt(ev.debtToCover || "0")) / Math.pow(10, debtDecimals)) *
        debtPrice

      const bonus = Math.max(0, collateralUSD - debtUSD)
      const protocolFee = bonus * 0.1

      const blockNum = Number(BigInt(ev.blockNumber || "0"))
      const blockAge = currentBlock - blockNum
      const approxTs = nowTs - blockAge * 2
      const key = dayTs(approxTs)

      map.set(key, (map.get(key) || 0) + protocolFee)
    }
  } catch (e: any) {
    console.error("Liq fee compute error:", e.message?.slice(0, 100))
  }
  return map
}

export async function GET() {
  if (resultCache && Date.now() - resultCacheTime < CACHE_TTL) {
    const r = NextResponse.json(resultCache)
    r.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600")
    return r
  }

  try {
    // Kick off background scans (non-blocking)
    scanFlashLoansBackground()
    scanDistributionRewardsBackground()

    // Fetch DefiLlama data + token info (the fast stuff)
    // sparklend = the lending pool itself (net interest income + flash + liq)
    // spark-liquidity-layer = ALM Proxy deployments into Morpho/Aave/Ethena/Curve/etc (yield - funding cost)
    const [feesData, revenueData, supplySideData, sllRevenueData, tokenInfo] =
      await Promise.all([
        fetchDefiLlamaFees("sparklend", "dailyFees"),
        fetchDefiLlamaFees("sparklend", "dailyRevenue"),
        fetchDefiLlamaFees("sparklend", "dailySupplySideRevenue"),
        fetchDefiLlamaFees("spark-liquidity-layer", "dailyRevenue"),
        getTokenInfo(),
      ])

    const priceMap = await getPriceMap(tokenInfo.addresses)
    const currentBlock = Number(await client.getBlockNumber())

    // Compute fee breakdowns from file caches (fast, no RPC calls)
    const dailyFlashFeesOnChain = computeFlashFees(
      currentBlock,
      tokenInfo.decimalsMap,
      priceMap
    )
    const dailyLiqFeesOnChain = computeLiqFees(
      currentBlock,
      tokenInfo.decimalsMap,
      priceMap
    )
    const dailyDistributionRewards = computeDistributionRewards()

    // Build lookup maps
    const revenueMap = new Map<number, number>()
    for (const [ts, val] of revenueData) revenueMap.set(ts, val)
    const supplyMap = new Map<number, number>()
    for (const [ts, val] of supplySideData) supplyMap.set(ts, val)
    const sllMap = new Map<number, number>()
    for (const [ts, val] of sllRevenueData) sllMap.set(ts, val)

    // ---- Estimate historical fee ratios ----
    // For days where we have on-chain data, compute the ratio of
    // flash fees and liquidation fees to total revenue.
    // Then apply those ratios to ALL days to get full historical breakdown.
    let totalRevenueInScanned = 0
    let totalFlashInScanned = 0
    let totalLiqInScanned = 0
    let scannedDays = 0

    for (const [ts, val] of feesData) {
      const flash = dailyFlashFeesOnChain.get(ts) || 0
      const liq = dailyLiqFeesOnChain.get(ts) || 0
      const rev = revenueMap.get(ts) || 0
      if (flash > 0 || liq > 0) {
        totalRevenueInScanned += rev
        totalFlashInScanned += flash
        totalLiqInScanned += liq
        scannedDays++
      }
    }

    // Average ratios: what fraction of protocol revenue comes from flash/liq
    const flashRatio =
      totalRevenueInScanned > 0
        ? totalFlashInScanned / totalRevenueInScanned
        : 0.02 // Default ~2% flash
    const liqRatio =
      totalRevenueInScanned > 0
        ? totalLiqInScanned / totalRevenueInScanned
        : 0.05 // Default ~5% liquidation

    // Merge into daily entries with full historical breakdown
    const daily = feesData.map(([timestamp, totalFees]) => {
      const revenue = revenueMap.get(timestamp) || 0
      const supplySideRevenue = supplyMap.get(timestamp) || 0
      const sllRevenue = sllMap.get(timestamp) || 0

      // Use on-chain data where available, otherwise estimate from ratios
      const hasOnChainFlash = dailyFlashFeesOnChain.has(timestamp)
      const hasOnChainLiq = dailyLiqFeesOnChain.has(timestamp)

      let flashloanFees: number
      let liquidationFees: number

      if (hasOnChainFlash || hasOnChainLiq) {
        // Use actual on-chain data
        flashloanFees = dailyFlashFeesOnChain.get(timestamp) || 0
        liquidationFees = dailyLiqFeesOnChain.get(timestamp) || 0
      } else {
        // Estimate from average ratios
        flashloanFees = revenue * flashRatio
        liquidationFees = revenue * liqRatio
      }

      const netInterestIncome = Math.max(
        0,
        revenue - flashloanFees - liquidationFees
      )

      return {
        date: timestamp,
        totalFees,
        revenue,
        supplySideRevenue,
        netInterestIncome,
        flashloanFees,
        liquidationFees,
        sllRevenue,
        distributionRewards: dailyDistributionRewards.get(timestamp) || 0,
      }
    })

    const result = { daily, meta: { flashRatio, liqRatio, scannedDays } }
    resultCache = result
    resultCacheTime = Date.now()

    const r = NextResponse.json(result)
    r.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600")
    return r
  } catch (error: any) {
    console.error("Financials API error:", error.message)
    if (resultCache) return NextResponse.json(resultCache)
    return NextResponse.json(
      { error: "Failed to fetch financials", details: error.message },
      { status: 500 }
    )
  }
}
