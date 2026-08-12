"use client"

import { MetricCard } from "@/components/metric-card"
import { ProtocolAreaChart } from "@/components/protocol-area-chart"
import { EcosystemTvlChart } from "@/components/ecosystem-tvl-chart"
import { CollateralConcentration } from "@/components/collateral-concentration"
import { WstEthPipeline } from "@/components/wsteth-pipeline"
import { DepositsBorrowsSankey } from "@/components/deposits-borrows-sankey"
import { PeerMarketShareRanked, SparkShareOverTime } from "@/components/peer-market-share"
import { PeerRevenueYoY } from "@/components/peer-revenue-yoy"
import { formatUSD } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { ProcessedDayData } from "@/lib/types"

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="h-8 w-64 bg-card-bg rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-card-bg rounded border border-card-border" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-[380px] bg-card-bg rounded border border-card-border" />
          <div className="h-[380px] bg-card-bg rounded border border-card-border" />
        </div>
        <div className="h-[380px] bg-card-bg rounded border border-card-border" />
      </div>
    </div>
  )
}

/**
 * IMPORTANT: DefiLlama's "Ethereum" chainTvl = Available Liquidity (supply - borrow),
 * NOT total supply. So:
 *   Total Supply   = Ethereum (TVL/liquidity) + Ethereum-borrowed
 *   Total Borrowed = Ethereum-borrowed
 *   Available Liquidity = Ethereum (TVL)
 *
 * For per-token supply: supply[token] = liquidity[token] + borrowed[token]
 */

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
      date: new Date(snapshot.date * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
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

/** Compute total supply = liquidity (TVL) + borrowed, per token */
function computeSupply(
  liquiditySnapshots: Array<{ date: number; tokens: Record<string, number> }>,
  borrowSnapshots: Array<{ date: number; tokens: Record<string, number> }>,
  daysBack: number
): { data: ProcessedDayData[]; allTokens: string[] } {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - daysBack * 24 * 60 * 60
  const liqFiltered = liquiditySnapshots.filter((s) => s.date >= cutoff)
  const borrowByDate = new Map<number, Record<string, number>>()
  borrowSnapshots
    .filter((s) => s.date >= cutoff)
    .forEach((s) => borrowByDate.set(s.date, s.tokens))

  const tokenSet = new Set<string>()
  liqFiltered.forEach((s) => Object.keys(s.tokens).forEach((t) => tokenSet.add(t)))
  borrowSnapshots
    .filter((s) => s.date >= cutoff)
    .forEach((s) => Object.keys(s.tokens).forEach((t) => tokenSet.add(t)))

  // Sort by latest total supply per token
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
      date: new Date(snapshot.date * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
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

/** Get 24h change from historical snapshots */
function get24hChange(
  snapshots: Array<{ date: number; totalLiquidityUSD: number }>
): number {
  if (snapshots.length < 2) return 0
  const latest = snapshots[snapshots.length - 1]
  const oneDayAgo = latest.date - 86400
  // Find the snapshot closest to 24h ago
  let closest = snapshots[0]
  for (const s of snapshots) {
    if (Math.abs(s.date - oneDayAgo) < Math.abs(closest.date - oneDayAgo)) {
      closest = s
    }
  }
  return latest.totalLiquidityUSD - closest.totalLiquidityUSD
}

export default function HomePage() {
  const { data: rawData, loading, error } = useCachedFetch("/api/sparklend", { ttl: 5 * 60_000 })
  const { data: ecoData } = useCachedFetch<{
    daily: Array<{ date: number; savings: number; sparklend: number; sll: number; total: number }>
    current: { savings: number; sparklend: number; sll: number; total: number }
  }>("/api/ecosystem", { ttl: 15 * 60_000 })
  const { data: peersData } = useCachedFetch<{
    daily: Array<Record<string, number>>
    current: Array<{ slug: string; name: string; isSpark: boolean; borrow: number; share: number }>
    currentTotal: number
    currentSparkShare: number
  }>("/api/peers", { ttl: 15 * 60_000 })
  const { data: peerRevData } = useCachedFetch<{
    peers: Array<{ slug: string; name: string; isSpark: boolean; recent90d: number; prior90d: number; yoyPct: number | null }>
    sll: { name: string; recent90d: number; prior90d: number; yoyPct: number | null }
    window: { days: number }
  }>("/api/peer-revenue", { ttl: 15 * 60_000 })

  if (loading) return <LoadingSkeleton />
  if (error || !rawData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-danger text-sm">Failed to load dashboard data</p>
          <p className="text-text-muted text-xs">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-card-bg border border-card-border rounded-md text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // DefiLlama "Ethereum" = available liquidity (TVL), NOT total supply
  // Total Supply = liquidity + borrowed
  const supply30 = computeSupply(rawData.supply.tokensInUsd, rawData.borrow.tokensInUsd, 30)
  const supply90 = computeSupply(rawData.supply.tokensInUsd, rawData.borrow.tokensInUsd, 90)
  const borrow30 = processTokenSnapshots(rawData.borrow.tokensInUsd, 30)
  const borrow90 = processTokenSnapshots(rawData.borrow.tokensInUsd, 90)
  // Available liquidity = DefiLlama "Ethereum" TVL directly
  const liq30 = processTokenSnapshots(rawData.supply.tokensInUsd, 30)
  const liq90 = processTokenSnapshots(rawData.supply.tokensInUsd, 90)

  // Current values: Ethereum TVL = available liquidity, Ethereum-borrowed = borrowed
  const currentLiquidity = rawData.currentChainTvls["Ethereum"] || 0
  const currentBorrow = rawData.currentChainTvls["Ethereum-borrowed"] || 0
  const currentSupply = currentLiquidity + currentBorrow

  // 24h changes
  const supplyChange = get24hChange(rawData.supply.tvl) + get24hChange(rawData.borrow.tvl)
  const borrowChange = get24hChange(rawData.borrow.tvl)
  const liquidityChange = get24hChange(rawData.supply.tvl)

  // Latest per-token snapshots for the collateral concentration donut.
  // supply-side value per token = liquidity[token] + borrowed[token].
  const latestSupply = rawData.supply.tokensInUsd?.at(-1)?.tokens || {}
  const latestBorrow = rawData.borrow.tokensInUsd?.at(-1)?.tokens || {}
  const collateralTokens: Record<string, number> = {}
  for (const [k, v] of Object.entries(latestSupply)) {
    collateralTokens[k] = (v as number) + ((latestBorrow[k] as number) || 0)
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Overview Section Label */}
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">
            Overview
          </h2>
          <div className="flex-1 h-px bg-card-border" />
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Total Supplied"
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
            label="Total Borrowed"
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
            label="Available Liquidity"
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

        {/* Hero: Spark Ecosystem TVL (3 product lines) */}
        {ecoData?.daily && ecoData.daily.length > 0 && (
          <EcosystemTvlChart daily={ecoData.daily} current={ecoData.current} />
        )}

        {/* Section divider */}
        <div className="tui-divider-labeled">
          <span className="tui-divider-label">Competitive Positioning</span>
        </div>

        {/* Peer market share: ranked bar + share over time */}
        {peersData?.current && peersData.daily && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeerMarketShareRanked peers={peersData} />
            <SparkShareOverTime peers={peersData} />
          </div>
        )}

        {/* Peer revenue YoY — the "Spark growing while peers shrink" narrative */}
        {peerRevData?.peers && (
          <PeerRevenueYoY peers={peerRevData.peers} sll={peerRevData.sll} window={peerRevData.window} />
        )}

        {/* Section divider */}
        <div className="tui-divider-labeled">
          <span className="tui-divider-label">SparkLend Positions</span>
        </div>

        {/* Collateral concentration + wstETH loop pipeline (side-by-side story) */}
        <CollateralConcentration
          tokens={collateralTokens}
          borrowTokens={latestBorrow as Record<string, number>}
        />
        <WstEthPipeline
          supplyTokens={rawData.supply.tokensInUsd}
          borrowTokens={rawData.borrow.tokensInUsd}
        />

        {/* Deposits vs Borrows Sankey - the flow-map story */}
        <DepositsBorrowsSankey
          supplyTokens={collateralTokens}
          borrowTokens={latestBorrow as Record<string, number>}
        />

        {/* Supply & Borrow Charts Side by Side */}
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
            data30d={borrow30.data}
            data90d={borrow90.data}
            allTokens30d={borrow30.allTokens}
            allTokens90d={borrow90.allTokens}
          />
        </div>

        {/* Available Liquidity Chart */}
        <ProtocolAreaChart
          title="Available Liquidity"
          subtitle="Available liquidity by asset over time (Supply - Borrow)"
          data30d={liq30.data}
          data90d={liq90.data}
          allTokens30d={liq30.allTokens}
          allTokens90d={liq90.allTokens}
        />
      </main>
    </div>
  )
}
