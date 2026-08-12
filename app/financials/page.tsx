"use client"

import { useMemo } from "react"
import { RevenueChart } from "@/components/financials/revenue-chart"
import { InterestChart } from "@/components/financials/interest-chart"
import { FeeChart } from "@/components/financials/fee-chart"
import { DistRewardsShareChart } from "@/components/financials/dist-rewards-share-chart"
import { formatUSD } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-32 bg-card-bg rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card-bg border border-card-border rounded-lg" />
        ))}
      </div>
      <div className="h-[340px] bg-card-bg border border-card-border rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
      </div>
    </div>
  )
}

export default function FinancialsPage() {
  const { data, loading, error } = useCachedFetch("/api/financials", { ttl: 10 * 60_000 })

  // Summary stats from last 30 days + prior 30 days for comparison
  const summary = useMemo(() => {
    if (!data?.daily) return null
    const now = Math.floor(Date.now() / 1000)
    const cutoff30 = now - 30 * 86400
    const cutoff60 = now - 60 * 86400
    const recent = data.daily.filter((d: any) => d.date >= cutoff30)
    const prior = data.daily.filter(
      (d: any) => d.date >= cutoff60 && d.date < cutoff30
    )

    const sparkLendRevenue30d = recent.reduce((s: number, d: any) => s + d.revenue, 0)
    const sllRevenue30d = recent.reduce((s: number, d: any) => s + (d.sllRevenue || 0), 0)
    const distRewards30d = recent.reduce((s: number, d: any) => s + (d.distributionRewards || 0), 0)
    const totalSparkRevenue30d = sparkLendRevenue30d + sllRevenue30d + distRewards30d

    const sparkLendPrior = prior.reduce((s: number, d: any) => s + d.revenue, 0)
    const sllPrior = prior.reduce((s: number, d: any) => s + (d.sllRevenue || 0), 0)
    const distPrior = prior.reduce((s: number, d: any) => s + (d.distributionRewards || 0), 0)
    const totalSparkPrior = sparkLendPrior + sllPrior + distPrior

    return {
      totalSparkRevenue30d,
      sparkLendRevenue30d,
      sllRevenue30d,
      distRewards30d,
      totalSparkChange: totalSparkPrior > 0 ? totalSparkRevenue30d - totalSparkPrior : 0,
      sparkLendChange: sparkLendPrior > 0 ? sparkLendRevenue30d - sparkLendPrior : 0,
      sllChange: sllPrior !== 0 ? sllRevenue30d - sllPrior : 0,
      distChange: distPrior !== 0 ? distRewards30d - distPrior : 0,
    }
  }, [data])

  if (loading) return <LoadingSkeleton />

  if (error || !data) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="text-center py-12">
          <p className="text-danger text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-card-bg border border-card-border rounded-md text-xs text-text-secondary hover:text-text-primary transition-colors">Retry</button>
        </div>
      </div>
    )
  }

  const daily = data.daily || []

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">
          Financials
        </h2>
        <div className="flex-1 h-px bg-card-border" />
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Spark Revenue (30d)", value: formatUSD(summary.totalSparkRevenue30d), change: summary.totalSparkChange, color: "#22c55e" },
            { label: "SparkLend Revenue (30d)", value: formatUSD(summary.sparkLendRevenue30d), change: summary.sparkLendChange, color: "#3b82f6" },
            { label: "SLL Revenue (30d)", value: formatUSD(summary.sllRevenue30d), change: summary.sllChange, color: "#f59e0b" },
            { label: "Distribution Rewards (30d)", value: formatUSD(summary.distRewards30d), change: summary.distChange, color: "#a855f7" },
          ].map((card) => (
            <div key={card.label} className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ backgroundColor: card.color }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2" style={{ color: card.color }}>{card.label}</span>
              <div className="flex items-baseline gap-2 pl-2">
                <span className="text-lg font-semibold text-text-primary tabular-nums">{card.value}</span>
                {card.change !== null && card.change !== 0 && (
                  <span className={`text-[11px] font-medium ${card.change > 0 ? "text-positive" : "text-danger"}`}>
                    {card.change > 0 ? "▲" : "▼"}{formatUSD(Math.abs(card.change))}
                  </span>
                )}
              </div>
              {card.change !== null && (
                <span className="text-[9px] text-text-muted mt-0.5 block pl-2">vs prior 30d</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 1. Spark Total Revenue (full width) */}
      <RevenueChart daily={daily} />

      {/* 2. Distribution Rewards share (full width) — the Q2 report narrative */}
      <DistRewardsShareChart daily={daily} />

      {/* 3. Total Interest Accrued + Net Interest Income (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InterestChart daily={daily} />
        <FeeChart
          title="Net Interest Income"
          subtitle="Protocol's share of borrower interest"
          daily={daily}
          dataKey="revenue"
          color="#22c55e"
          methodology={`Net Interest Income is the protocol treasury's cut of all borrower interest payments.\n\nFor each lending market, the Reserve Factor determines what percentage of accrued interest flows to the protocol vs. lenders. For example, if WETH has a 15% Reserve Factor, the protocol retains 15% of all WETH borrowing interest.\n\nThis is SparkLend's primary and most stable revenue stream, directly proportional to total borrows and prevailing interest rates across all markets.`}
        />
      </div>

      {/* 3. Flashloan Fees + Liquidation Fees (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FeeChart
          title="Flashloan Fees"
          subtitle="Fees collected from flash loan operations"
          daily={daily}
          dataKey="flashloanFees"
          color="#8b5cf6"
          methodology={`Flash loan fees are premiums paid by users who execute uncollateralized flash loans on SparkLend.\n\nFlash loans allow borrowing any amount without collateral, provided the loan is repaid within the same transaction. A premium (typically 0.05% of the borrowed amount) is charged per flash loan.\n\nThis fee is split between the protocol treasury and liquidity providers based on the flash loan premium configuration.\n\nFlash loans are commonly used for arbitrage, collateral swaps, self-liquidation, and leverage strategies. Data is sourced from on-chain FlashLoan events emitted by the SparkLend Pool contract.`}
        />
        <FeeChart
          title="Liquidation Fees"
          subtitle="Protocol's share of liquidation penalties"
          daily={daily}
          dataKey="liquidationFees"
          color="#FF6B35"
          methodology={`Liquidation fees represent the protocol's share of penalties collected during the liquidation of undercollateralized positions.\n\nWhen a borrower's health factor falls below 1.0, their position becomes eligible for liquidation. The liquidator repays part of the debt and receives collateral at a discount (the Liquidation Bonus, typically 5-10% depending on the asset).\n\nThe protocol retains approximately 10% of this liquidation bonus as a protocol fee, configured per asset in the reserve parameters.\n\nData is derived from on-chain LiquidationCall events, with the protocol fee estimated based on the configured liquidation protocol fee percentage for each collateral asset.`}
        />
      </div>

    </div>
  )
}
