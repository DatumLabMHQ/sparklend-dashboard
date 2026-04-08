import { NextResponse } from "next/server"
import {
  client,
  POOL,
  POOL_ADDRESSES_PROVIDER,
  poolAddressesProviderAbi,
  poolDataProviderAbi,
  oracleAbi,
} from "@/lib/contracts"
import { type Address, parseAbiItem } from "viem"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

export const dynamic = "force-dynamic"

const FLASH_CACHE_FILE = join(process.cwd(), ".flashloan-cache.json")
const LIQ_CACHE_FILE = join(process.cwd(), ".liquidation-cache.json")
const SCAN_CHUNK = 10000n

let resultCache: any = null
let resultCacheTime = 0
const CACHE_TTL = 1800_000 // 30 min
let scanningInProgress = false

// ---------- DefiLlama helpers ----------
async function fetchDefiLlamaFees(
  dataType: string
): Promise<Array<[number, number]>> {
  const res = await fetch(
    `https://api.llama.fi/summary/fees/sparklend?dataType=${dataType}`,
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
    // Kick off background flash scan (non-blocking)
    scanFlashLoansBackground()

    // Fetch DefiLlama data + token info (the fast stuff)
    const [feesData, revenueData, supplySideData, tokenInfo] =
      await Promise.all([
        fetchDefiLlamaFees("dailyFees"),
        fetchDefiLlamaFees("dailyRevenue"),
        fetchDefiLlamaFees("dailySupplySideRevenue"),
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

    // Build lookup maps
    const revenueMap = new Map<number, number>()
    for (const [ts, val] of revenueData) revenueMap.set(ts, val)
    const supplyMap = new Map<number, number>()
    for (const [ts, val] of supplySideData) supplyMap.set(ts, val)

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
