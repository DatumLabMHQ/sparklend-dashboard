"use client"

import { MarketsTable } from "@/components/markets/markets-table"
import { ProtocolAreaChart } from "@/components/protocol-area-chart"
import { CollateralConcentration } from "@/components/collateral-concentration"
import { WstEthPipeline } from "@/components/wsteth-pipeline"
import { DepositsBorrowsSankey } from "@/components/deposits-borrows-sankey"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { ProcessedDayData } from "@/lib/types"

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-24 bg-card-bg rounded" />
      <div className="bg-card-bg border border-card-border rounded-lg">
        <div className="h-10 border-b border-card-border" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-card-border/50" />
        ))}
      </div>
    </div>
  )
}

function processTokenSnapshots(
  snapshots: Array<{ date: number; tokens: Record<string, number> }>,
  daysBack: number
): { data: ProcessedDayData[]; allTokens: string[] } {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - daysBack * 24 * 60 * 60
  const filtered = snapshots.filter((s) => s.date >= cutoff)
  const tokenSet = new Set<string>()
  filtered.forEach((s) => Object.keys(s.tokens).forEach((t) => tokenSet.add(t)))

  const lastSnapshot = filtered[filtered.length - 1]
  const allTokens = Array.from(tokenSet).sort((a, b) => {
    const valA = lastSnapshot?.tokens[a] || 0
    const valB = lastSnapshot?.tokens[b] || 0
    return valB - valA
  })

  const data = filtered.map((snapshot) => {
    const total = Object.values(snapshot.tokens).reduce((sum, v) => sum + v, 0)
    const entry: any = {
      date: new Date(snapshot.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      timestamp: snapshot.date,
      total,
    }
    allTokens.forEach((token) => {
      entry[token] = snapshot.tokens[token] || 0
    })
    return entry as ProcessedDayData
  })
  return { data, allTokens }
}

function computeSupply(
  liquiditySnapshots: Array<{ date: number; tokens: Record<string, number> }>,
  borrowSnapshots: Array<{ date: number; tokens: Record<string, number> }>,
  daysBack: number
): { data: ProcessedDayData[]; allTokens: string[] } {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - daysBack * 24 * 60 * 60
  const liqFiltered = liquiditySnapshots.filter((s) => s.date >= cutoff)
  const borrowByDate = new Map<number, Record<string, number>>()
  borrowSnapshots.filter((s) => s.date >= cutoff).forEach((s) => borrowByDate.set(s.date, s.tokens))

  const tokenSet = new Set<string>()
  liqFiltered.forEach((s) => Object.keys(s.tokens).forEach((t) => tokenSet.add(t)))
  borrowSnapshots.filter((s) => s.date >= cutoff).forEach((s) => Object.keys(s.tokens).forEach((t) => tokenSet.add(t)))

  const lastLiq = liqFiltered[liqFiltered.length - 1]
  const lastBorrow = borrowByDate.get(lastLiq?.date) || {}
  const allTokens = Array.from(tokenSet).sort((a, b) => {
    const supA = (lastLiq?.tokens[a] || 0) + (lastBorrow[a] || 0)
    const supB = (lastLiq?.tokens[b] || 0) + (lastBorrow[b] || 0)
    return supB - supA
  })

  const data = liqFiltered.map((snapshot) => {
    const borrowTokens = borrowByDate.get(snapshot.date) || {}
    let total = 0
    const entry: any = {
      date: new Date(snapshot.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      timestamp: snapshot.date,
      total: 0,
    }
    allTokens.forEach((token) => {
      const supply = (snapshot.tokens[token] || 0) + (borrowTokens[token] || 0)
      entry[token] = supply
      total += supply
    })
    entry.total = total
    return entry as ProcessedDayData
  })
  return { data, allTokens }
}

export default function SparkLendPage() {
  const { data: rawData, loading, error } = useCachedFetch("/api/markets", { ttl: 2 * 60_000 })
  const { data: sparklendData } = useCachedFetch<any>("/api/sparklend", { ttl: 5 * 60_000 })
  const marketsData = rawData || []

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="text-center py-12">
          <p className="text-danger text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-card-bg border border-card-border rounded-md text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Derived: per-token asset breakdowns (only when sparklendData is loaded)
  const supply30 = sparklendData
    ? computeSupply(sparklendData.supply.tokensInUsd, sparklendData.borrow.tokensInUsd, 30)
    : null
  const supply90 = sparklendData
    ? computeSupply(sparklendData.supply.tokensInUsd, sparklendData.borrow.tokensInUsd, 90)
    : null
  const borrow30 = sparklendData ? processTokenSnapshots(sparklendData.borrow.tokensInUsd, 30) : null
  const borrow90 = sparklendData ? processTokenSnapshots(sparklendData.borrow.tokensInUsd, 90) : null
  const liq30 = sparklendData ? processTokenSnapshots(sparklendData.supply.tokensInUsd, 30) : null
  const liq90 = sparklendData ? processTokenSnapshots(sparklendData.supply.tokensInUsd, 90) : null

  const latestSupply = sparklendData?.supply.tokensInUsd?.at(-1)?.tokens || {}
  const latestBorrow = sparklendData?.borrow.tokensInUsd?.at(-1)?.tokens || {}
  const collateralTokens: Record<string, number> = {}
  for (const [k, v] of Object.entries(latestSupply)) {
    collateralTokens[k] = (v as number) + ((latestBorrow[k] as number) || 0)
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">SparkLend</h2>
        <div className="flex-1 h-px bg-card-border" />
      </div>

      {/* Markets table — per-market rates, TVL, utilization */}
      <MarketsTable data={marketsData} />

      {/* Section divider */}
      <div className="tui-divider-labeled">
        <span className="tui-divider-label">Asset-level Breakdown</span>
      </div>

      {/* Per-asset supply / borrow / liquidity charts */}
      {supply30 && supply90 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProtocolAreaChart
            title="Total Supply"
            subtitle="Supply by asset over time"
            data30d={supply30.data}
            data90d={supply90.data}
            allTokens30d={supply30.allTokens}
            allTokens90d={supply90.allTokens}
          />
          <ProtocolAreaChart
            title="Total Borrow"
            subtitle="Borrow by asset over time"
            data30d={borrow30!.data}
            data90d={borrow90!.data}
            allTokens30d={borrow30!.allTokens}
            allTokens90d={borrow90!.allTokens}
          />
        </div>
      )}

      {liq30 && liq90 && (
        <ProtocolAreaChart
          title="Available Liquidity"
          subtitle="Available liquidity by asset over time (Supply - Borrow)"
          data30d={liq30.data}
          data90d={liq90.data}
          allTokens30d={liq30.allTokens}
          allTokens90d={liq90.allTokens}
        />
      )}

      {/* Section divider */}
      <div className="tui-divider-labeled">
        <span className="tui-divider-label">Concentration &amp; Flows</span>
      </div>

      {/* Collateral concentration + wstETH loop pipeline */}
      {sparklendData && (
        <>
          <CollateralConcentration
            tokens={collateralTokens}
            borrowTokens={latestBorrow as Record<string, number>}
          />
          <WstEthPipeline
            supplyTokens={sparklendData.supply.tokensInUsd}
            borrowTokens={sparklendData.borrow.tokensInUsd}
          />
          <DepositsBorrowsSankey
            supplyTokens={collateralTokens}
            borrowTokens={latestBorrow as Record<string, number>}
          />
        </>
      )}
    </div>
  )
}
