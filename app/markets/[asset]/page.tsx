"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { MarketOverview } from "@/components/asset-detail/market-overview"
import { ParamsCard } from "@/components/asset-detail/params-card"
import { LineChartCard } from "@/components/asset-detail/line-chart-card"
import { InterestRateCurve } from "@/components/asset-detail/interest-rate-curve"
import { CollateralDonut } from "@/components/asset-detail/collateral-donut"
import { formatPercent, formatTokenAmount, getTokenName } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"

/**
 * Compute proportional asset composition for a market's detail page.
 * side="borrowed-against": for wallets holding `focusSymbol` as collateral,
 *   attribute each wallet's borrows proportionally to focusSymbol's share of
 *   their collateral, then sum by asset.
 * side="collateral-for": for wallets borrowing `focusSymbol`, attribute each
 *   wallet's collateral proportionally to focusSymbol's share of their borrows.
 */
/**
 * Case-insensitive lookup — collateralUsd/borrowUsd keys use canonical
 * mixed case (wstETH, USDS, cbBTC) while the URL slug may arrive in any
 * case. Match by uppercase and return the actual key/value.
 */
function findValue(map: Record<string, number>, focusUpper: string): number {
  for (const [k, v] of Object.entries(map)) {
    if (k.toUpperCase() === focusUpper) return v || 0
  }
  return 0
}

function computeComposition(
  positions: any[],
  focusSymbol: string,
  side: "borrowed-against" | "collateral-for"
): Array<{ symbol: string; valueUSD: number; percentage: number }> {
  const focus = focusSymbol.toUpperCase()
  const perAsset = new Map<string, number>()
  for (const p of positions) {
    const collateralUsd = (p.collateralUsd || {}) as Record<string, number>
    const borrowUsd = (p.borrowUsd || {}) as Record<string, number>
    const collTotal = Object.values(collateralUsd).reduce((s, v) => s + (v || 0), 0)
    const debtTotal = Object.values(borrowUsd).reduce((s, v) => s + (v || 0), 0)
    if (side === "borrowed-against") {
      // Wallets with focus as collateral -> their borrows attributed by focus share.
      const focusColl = findValue(collateralUsd, focus)
      if (focusColl <= 0 || collTotal <= 0) continue
      const share = focusColl / collTotal
      for (const [sym, usd] of Object.entries(borrowUsd)) {
        if (!(usd > 0)) continue
        perAsset.set(sym, (perAsset.get(sym) || 0) + usd * share)
      }
    } else {
      // Wallets borrowing focus -> their collateral attributed by focus share.
      const focusDebt = findValue(borrowUsd, focus)
      if (focusDebt <= 0 || debtTotal <= 0) continue
      const share = focusDebt / debtTotal
      for (const [sym, usd] of Object.entries(collateralUsd)) {
        if (!(usd > 0)) continue
        perAsset.set(sym, (perAsset.get(sym) || 0) + usd * share)
      }
    }
  }
  const total = Array.from(perAsset.values()).reduce((s, v) => s + v, 0)
  if (total <= 0) return []
  return Array.from(perAsset.entries())
    .map(([symbol, valueUSD]) => ({
      symbol,
      valueUSD,
      percentage: (valueUSD / total) * 100,
    }))
    .sort((a, b) => b.valueUSD - a.valueUSD)
}

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-4 w-40 bg-card-bg rounded" />
      <div className="h-32 bg-card-bg border border-card-border rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-card-bg border border-card-border rounded-lg" />
        <div className="h-48 bg-card-bg border border-card-border rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
      </div>
    </div>
  )
}

export default function AssetDetailPage() {
  const params = useParams()
  const assetSlug = params.asset as string

  const { data: detail, loading: loadDetail, error: errDetail } = useCachedFetch(
    `/api/markets/${assetSlug}`,
    { ttl: 2 * 60_000 }
  )
  const { data: history30, loading: loadH30 } = useCachedFetch(
    `/api/markets/${assetSlug}/history?days=30`,
    { ttl: 5 * 60_000 }
  )
  const { data: history90, loading: loadH90 } = useCachedFetch(
    `/api/markets/${assetSlug}/history?days=90`,
    { ttl: 5 * 60_000 }
  )
  // Wallets data feeds the composition donuts. Top ~100 users carry the
  // per-asset USD breakdown we need for proportional attribution.
  const { data: wallets } = useCachedFetch<{ positions: any[] }>(
    "/api/wallets?page=1&pageSize=200",
    { ttl: 15 * 60_000 }
  )

  const loading = loadDetail || loadH30 || loadH90
  const error = errDetail

  if (loading) return <LoadingSkeleton />

  if (error || !detail) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="text-center py-12">
          <p className="text-danger text-sm">{error || "Asset not found"}</p>
          <Link
            href="/markets"
            className="mt-3 inline-block px-4 py-2 bg-card-bg border border-card-border rounded-md text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Back to Markets
          </Link>
        </div>
      </div>
    )
  }

  const sym = getTokenName(detail.symbol)

  // Interest rate params
  const interestParams = [
    { label: "Supply APY", value: formatPercent(detail.supplyAPY) },
    { label: "Borrow APY", value: formatPercent(detail.borrowAPY) },
    { label: "Base Rate", value: formatPercent(detail.baseRate) },
    { label: "Multiplier", value: formatPercent(detail.slope1) },
    { label: "Jump Multiplier", value: formatPercent(detail.slope2) },
    { label: "Kink", value: formatPercent(detail.optimalUtilization) },
  ]

  // Risk params
  const riskParams = [
    { label: "Collateral Factor", value: formatPercent(detail.ltv) },
    { label: "Liquidation Bonus", value: formatPercent(detail.liquidationBonus) },
    {
      label: "Supply Cap",
      value: detail.supplyCap > 0
        ? `${formatTokenAmount(detail.supplyCap)} ${sym}`
        : "No limit",
    },
    {
      label: "Borrow Cap",
      value: detail.borrowCap > 0
        ? `${formatTokenAmount(detail.borrowCap)} ${sym}`
        : "No limit",
    },
  ]

  // Prepare chart data (safe defaults if history not yet loaded)
  const h30 = history30 || []
  const h90 = history90 || []

  const rateHistory30 = h30
    .filter((h: any) => h.supplyAPY != null)
    .map((h: any) => ({
      date: h.date,
      supplyAPY: h.supplyAPY,
      borrowAPY: h.borrowAPY ?? h.supplyAPY * 1.5,
    }))
  const rateHistory90 = h90
    .filter((h: any) => h.supplyAPY != null)
    .map((h: any) => ({
      date: h.date,
      supplyAPY: h.supplyAPY,
      borrowAPY: h.borrowAPY ?? h.supplyAPY * 1.5,
    }))

  const utilHistory30 = h30.map((h: any) => ({
    date: h.date,
    utilization: h.utilization,
  }))
  const utilHistory90 = h90.map((h: any) => ({
    date: h.date,
    utilization: h.utilization,
  }))

  // Cap utilization (use supply/borrow amounts vs caps)
  const supplyCapUtil30 = detail.supplyCap > 0
    ? h30.map((h: any) => ({
        date: h.date,
        capUtil: Math.min(100, ((h.supplyUsd / detail.price) / detail.supplyCap) * 100),
      }))
    : []
  const supplyCapUtil90 = detail.supplyCap > 0
    ? h90.map((h: any) => ({
        date: h.date,
        capUtil: Math.min(100, ((h.supplyUsd / detail.price) / detail.supplyCap) * 100),
      }))
    : []

  const borrowCapUtil30 = detail.borrowCap > 0
    ? h30.map((h: any) => ({
        date: h.date,
        capUtil: Math.min(100, ((h.borrowUsd / detail.price) / detail.borrowCap) * 100),
      }))
    : []
  const borrowCapUtil90 = detail.borrowCap > 0
    ? h90.map((h: any) => ({
        date: h.date,
        capUtil: Math.min(100, ((h.borrowUsd / detail.price) / detail.borrowCap) * 100),
      }))
    : []

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <Link href="/markets" className="text-text-muted hover:text-text-secondary transition-colors">
          Markets
        </Link>
        <span className="text-text-muted">&gt;</span>
        <span className="text-text-primary font-medium">{sym}</span>
      </div>

      {/* Asset Title */}
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">{sym}</h2>
        <span className="text-[10px] text-text-muted">— Market stats and information</span>
        <div className="flex-1 h-px bg-card-border" />
      </div>

      {/* Section 1: Market Overview */}
      <MarketOverview
        symbol={detail.symbol}
        totalSupply={detail.totalSupply}
        totalSupplyRaw={detail.totalSupplyRaw}
        totalBorrow={detail.totalBorrow}
        totalBorrowRaw={detail.totalBorrowRaw}
        liquidity={detail.liquidity}
        liquidityRaw={detail.liquidityRaw}
        price={detail.price}
        utilization={detail.utilization}
      />

      {/* Section 2: Interest Rates + Risk Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ParamsCard title="Interest Rates" params={interestParams} />
        <ParamsCard title="Risk Parameters" params={riskParams} />
      </div>

      {/* Section 3: Rate History + Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChartCard
          title="Interest Rate History"
          data30d={rateHistory30}
          data90d={rateHistory90}
          lines={[
            { dataKey: "supplyAPY", color: "#22c55e", label: "Supply APY" },
            { dataKey: "borrowAPY", color: "#FF6B35", label: "Borrow APY" },
          ]}
        />
        <LineChartCard
          title="Asset Utilization"
          data30d={utilHistory30}
          data90d={utilHistory90}
          lines={[
            { dataKey: "utilization", color: "#FF6B35", label: "Utilization" },
          ]}
        />
      </div>

      {/* Section 4: Supply Cap Util + Borrow Cap Util */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChartCard
          title="Supply Cap Utilization"
          data30d={supplyCapUtil30}
          data90d={supplyCapUtil90}
          lines={[
            { dataKey: "capUtil", color: "#8b5cf6", label: "Supply Cap Used" },
          ]}
          referenceY={100}
          referenceYColor="#ef4444"
        />
        <LineChartCard
          title="Borrow Cap Utilization"
          data30d={borrowCapUtil30}
          data90d={borrowCapUtil90}
          lines={[
            { dataKey: "capUtil", color: "#f97316", label: "Borrow Cap Used" },
          ]}
          referenceY={100}
          referenceYColor="#ef4444"
        />
      </div>

      {/* Section 5: Interest Rate Curve */}
      <InterestRateCurve
        baseRate={detail.baseRate}
        slope1={detail.slope1}
        slope2={detail.slope2}
        optimalUtilization={detail.optimalUtilization}
        currentUtilization={detail.utilization}
        reserveFactor={detail.reserveFactor}
      />

      {/* Section 6: Asset Composition Donuts */}
      <AssetCompositionSection
        symbol={detail.symbol}
        walletPositions={wallets?.positions || []}
      />
    </div>
  )
}

function AssetCompositionSection({
  symbol,
  walletPositions,
}: {
  symbol: string
  walletPositions: any[]
}) {
  const sym = getTokenName(symbol)
  const positionsWithBreakdown = useMemo(
    () => walletPositions.filter((p) => p.collateralUsd && p.borrowUsd),
    [walletPositions]
  )
  const borrowedAgainst = useMemo(
    () => computeComposition(positionsWithBreakdown, symbol, "borrowed-against"),
    [positionsWithBreakdown, symbol]
  )
  const collateralFor = useMemo(
    () => computeComposition(positionsWithBreakdown, symbol, "collateral-for"),
    [positionsWithBreakdown, symbol]
  )

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollateralDonut
          title={`Assets Borrowed Against ${sym}`}
          subtitle={`What ${sym} depositors borrow — proportional attribution across top ${positionsWithBreakdown.length} wallets`}
          data={borrowedAgainst}
        />
        <CollateralDonut
          title={`Collateral Used to Borrow ${sym}`}
          subtitle={`What ${sym} borrowers post as collateral — proportional attribution across top ${positionsWithBreakdown.length} wallets`}
          data={collateralFor}
        />
      </div>
      {positionsWithBreakdown.length === 0 && (
        <p className="text-[10px] text-text-muted text-center">
          Wallet-level breakdown is loading — refresh in a moment to see the composition.
        </p>
      )}
    </>
  )
}
