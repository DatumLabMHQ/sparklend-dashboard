"use client"

import { MarketsTable } from "@/components/markets/markets-table"
import { MetricCard } from "@/components/metric-card"
import { ProtocolAreaChart } from "@/components/protocol-area-chart"
import { AssetMixDonut } from "@/components/asset-mix-donut"
import { WstEthPipeline } from "@/components/wsteth-pipeline"
import { DepositsBorrowsSankey } from "@/components/deposits-borrows-sankey"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { ProcessedDayData } from "@/lib/types"

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-24 bg-card-bg rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card-bg border border-card-border rounded" />
        ))}
      </div>
      <div className="h-[300px] bg-card-bg border border-card-border rounded" />
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

function get24hChange(snapshots: Array<{ date: number; totalLiquidityUSD: number }>): number {
  if (snapshots.length < 2) return 0
  const latest = snapshots[snapshots.length - 1]
  const oneDayAgo = latest.date - 86400
  let closest = snapshots[0]
  for (const s of snapshots) {
    if (Math.abs(s.date - oneDayAgo) < Math.abs(closest.date - oneDayAgo)) {
      closest = s
    }
  }
  return latest.totalLiquidityUSD - closest.totalLiquidityUSD
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

  // Derived: per-token asset breakdowns
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

  const latestSupply = (sparklendData?.supply.tokensInUsd?.at(-1)?.tokens || {}) as Record<string, number>
  const latestBorrow = (sparklendData?.borrow.tokensInUsd?.at(-1)?.tokens || {}) as Record<string, number>
  const totalCollateralByToken: Record<string, number> = {}
  for (const [k, v] of Object.entries(latestSupply)) {
    totalCollateralByToken[k] = (v as number) + (latestBorrow[k] || 0)
  }

  // Daily snapshots aligned by date for the two mix donuts.
  // Collateral snapshot per day = liquidity[token] + borrowed[token].
  const collateralSnapshots = (() => {
    if (!sparklendData) return []
    const borrowByDate = new Map<number, Record<string, number>>()
    for (const s of sparklendData.borrow.tokensInUsd || []) {
      borrowByDate.set(s.date, s.tokens)
    }
    return (sparklendData.supply.tokensInUsd || []).map((s: any) => {
      const b = borrowByDate.get(s.date) || {}
      const merged: Record<string, number> = {}
      for (const [k, v] of Object.entries(s.tokens as Record<string, number>)) {
        merged[k] = (v as number) + (b[k] || 0)
      }
      // Include borrow-only tokens too
      for (const [k, v] of Object.entries(b as Record<string, number>)) {
        if (merged[k] == null) merged[k] = v || 0
      }
      return { date: s.date, tokens: merged }
    })
  })()
  const borrowSnapshots = sparklendData?.borrow.tokensInUsd || []

  // Aggregate metrics for top stat cards
  const currentLiquidity = sparklendData?.currentChainTvls?.["Ethereum"] || 0
  const currentBorrow = sparklendData?.currentChainTvls?.["Ethereum-borrowed"] || 0
  const currentSupply = currentLiquidity + currentBorrow
  const supplyChange = sparklendData
    ? get24hChange(sparklendData.supply.tvl) + get24hChange(sparklendData.borrow.tvl)
    : 0
  const borrowChange = sparklendData ? get24hChange(sparklendData.borrow.tvl) : 0
  const liquidityChange = sparklendData ? get24hChange(sparklendData.supply.tvl) : 0

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">SparkLend</h2>
        <div className="flex-1 h-px bg-card-border" />
      </div>

      {/* Metric cards: Total Supply, Total Borrow, TVL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Total Supply"
          value={currentSupply}
          change24h={supplyChange}
          accentColor="#22c55e"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          }
        />
        <MetricCard
          label="Total Borrows"
          value={currentBorrow}
          change24h={borrowChange}
          accentColor="#FF6B35"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
              <polyline points="16 17 22 17 22 11" />
            </svg>
          }
        />
        <MetricCard
          label="Total Value Locked"
          value={currentLiquidity}
          change24h={liquidityChange}
          accentColor="#8b5cf6"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      </div>

      {/* Section divider */}
      <div className="tui-divider-labeled">
        <span className="tui-divider-label">Asset-level Breakdown</span>
      </div>

      {/* Per-asset supply / borrow charts (side-by-side) + available liquidity (full width) */}
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

      {sparklendData && (
        <>
          {/* Collateral + Borrow mix in TWO separate panels, each with its
              own period filter (Current / W / M / Q). */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AssetMixDonut
              title="Collateral Mix"
              subtitle="Supply-side value by asset — total supplied to SparkLend"
              snapshots={collateralSnapshots}
              accentToken="wstETH"
              totalLabel="Supply / Collateral"
              methodology={
                <>
                  Composition of what&apos;s deposited into SparkLend, i.e. supply-side value
                  per asset. wstETH highlighted in Spark orange because it has been the dominant
                  collateral asset for most of the pool&apos;s life. Switch to W / M / Q to view
                  the trailing 7 / 30 / 90 day average — a spike in a single day won&apos;t
                  dominate the averaged view.
                </>
              }
            />
            <AssetMixDonut
              title="Borrow Mix"
              subtitle="Outstanding loans by asset"
              snapshots={borrowSnapshots}
              accentToken="WETH"
              totalLabel="Borrow"
              methodology={
                <>
                  Composition of what&apos;s borrowed from SparkLend. WETH highlighted because
                  it is the dominant borrow asset, completing the wstETH → WETH leverage-stake
                  loop that is SparkLend&apos;s signature flow. Period toggle shows current
                  vs trailing-period average.
                </>
              }
            />
          </div>
          <WstEthPipeline
            supplyTokens={sparklendData.supply.tokensInUsd}
            borrowTokens={sparklendData.borrow.tokensInUsd}
          />
          <DepositsBorrowsSankey
            supplyTokens={totalCollateralByToken}
            borrowTokens={latestBorrow}
          />
        </>
      )}

      {/* Section divider */}
      <div className="tui-divider-labeled">
        <span className="tui-divider-label">Markets</span>
      </div>

      {/* Markets table at bottom - per-market rates, TVL, utilization */}
      <MarketsTable data={marketsData} />
    </div>
  )
}
