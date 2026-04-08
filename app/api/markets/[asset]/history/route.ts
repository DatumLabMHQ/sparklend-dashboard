import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Cache pool UUID mappings
let poolMapCache: Record<string, string> | null = null
let poolMapTimestamp = 0
const POOL_MAP_TTL = 86400000 // 24h

async function getPoolMap(): Promise<Record<string, string>> {
  if (poolMapCache && Date.now() - poolMapTimestamp < POOL_MAP_TTL) {
    return poolMapCache
  }
  const res = await fetch("https://yields.llama.fi/pools")
  const data = await res.json()
  const map: Record<string, string> = {}
  for (const pool of data.data || []) {
    if (pool.project === "sparklend" && pool.chain === "Ethereum") {
      // symbol is like "WETH" or "DAI"
      const sym = pool.symbol?.toUpperCase()
      if (sym) map[sym] = pool.pool
    }
  }
  poolMapCache = map
  poolMapTimestamp = Date.now()
  return map
}

async function getDefiLlamaProtocolHistory(symbol: string, days: number) {
  const res = await fetch("https://api.llama.fi/protocol/sparklend")
  if (!res.ok) return null
  const data = await res.json()

  const ethSupply = data.chainTvls?.["Ethereum"]?.tokensInUsd || []
  const ethBorrow = data.chainTvls?.["Ethereum-borrowed"]?.tokensInUsd || []

  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - days * 86400

  // Build borrow lookup
  const borrowByDate = new Map<number, number>()
  for (const snap of ethBorrow) {
    if (snap.date >= cutoff) {
      borrowByDate.set(snap.date, snap.tokens?.[symbol] || 0)
    }
  }

  const history: Array<{
    date: string
    timestamp: number
    supplyUsd: number
    borrowUsd: number
    liquidityUsd: number
    utilization: number
  }> = []

  for (const snap of ethSupply) {
    if (snap.date < cutoff) continue
    const liquidityUsd = snap.tokens?.[symbol] || 0
    const borrowUsd = borrowByDate.get(snap.date) || 0
    const supplyUsd = liquidityUsd + borrowUsd
    const utilization = supplyUsd > 0 ? (borrowUsd / supplyUsd) * 100 : 0

    history.push({
      date: new Date(snap.date * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      timestamp: snap.date,
      supplyUsd,
      borrowUsd,
      liquidityUsd,
      utilization,
    })
  }

  return history
}

async function getYieldHistory(poolUUID: string, days: number) {
  const res = await fetch(`https://yields.llama.fi/chart/${poolUUID}`)
  if (!res.ok) return null
  const data = await res.json()

  const now = Date.now()
  const cutoff = now - days * 86400000

  return (data.data || [])
    .filter((d: any) => new Date(d.timestamp).getTime() >= cutoff)
    .map((d: any) => ({
      date: new Date(d.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      timestamp: Math.floor(new Date(d.timestamp).getTime() / 1000),
      supplyAPY: d.apyBase || d.apy || 0,
      tvlUsd: d.tvlUsd || 0,
    }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { asset: string } }
) {
  try {
    const symbol = params.asset.toUpperCase()
    const days = Number(request.nextUrl.searchParams.get("days") || "30")

    const [poolMap, protocolHistory] = await Promise.all([
      getPoolMap(),
      getDefiLlamaProtocolHistory(symbol, days),
    ])

    const poolUUID = poolMap[symbol]
    let yieldHistory: any[] | null = null
    if (poolUUID) {
      yieldHistory = await getYieldHistory(poolUUID, days)
    }

    // Merge yield history (supply APY) with protocol history (utilization, supply/borrow)
    const result: any[] = []

    if (protocolHistory && protocolHistory.length > 0) {
      // Build a yield APY lookup by date string
      const apyByDate = new Map<string, number>()
      if (yieldHistory) {
        for (const yh of yieldHistory) {
          apyByDate.set(yh.date, yh.supplyAPY)
        }
      }

      for (const ph of protocolHistory) {
        const supplyAPY = apyByDate.get(ph.date) ?? null
        // Derive borrow APY from supply APY and utilization
        // borrowAPY ≈ supplyAPY / (utilization/100 * (1 - reserveFactor))
        // We don't have reserveFactor here, so just use a reasonable approximation
        let borrowAPY: number | null = null
        if (supplyAPY !== null && ph.utilization > 0) {
          // Approximate: assume reserveFactor ~10-20%, use supply/util ratio
          borrowAPY = supplyAPY / (ph.utilization / 100) * 1.1
        }

        result.push({
          date: ph.date,
          timestamp: ph.timestamp,
          supplyAPY,
          borrowAPY,
          utilization: ph.utilization,
          supplyUsd: ph.supplyUsd,
          borrowUsd: ph.borrowUsd,
          liquidityUsd: ph.liquidityUsd,
        })
      }
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
      },
    })
  } catch (error: any) {
    console.error("History API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch history", details: error.message },
      { status: 500 }
    )
  }
}
