"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { MarketOverview } from "@/components/asset-detail/market-overview"
import { ParamsCard } from "@/components/asset-detail/params-card"
import { LineChartCard } from "@/components/asset-detail/line-chart-card"
import { InterestRateCurve } from "@/components/asset-detail/interest-rate-curve"
import { CollateralDonut } from "@/components/asset-detail/collateral-donut"
import { formatPercent, formatTokenAmount, getTokenName } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"

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

      {/* Section 6: Donut Charts (v2 placeholders) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollateralDonut
          title={`Assets Borrowed Against ${sym}`}
          subtitle={`Distribution of borrowed assets proportionally attributed to ${sym} collateral`}
          data={[]}
        />
        <CollateralDonut
          title={`Collateral Used to Borrow ${sym}`}
          subtitle={`Distribution of collateral assets proportionally attributed to ${sym} borrowing`}
          data={[]}
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-card-border pt-4 pb-8 flex items-center justify-between">
        <p className="text-[10px] text-text-muted">
          Data sourced from SparkLend on-chain contracts + DefiLlama. Updated every 2 minutes.
        </p>
        <p className="text-[10px] text-text-muted">
          Datum Labs &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
