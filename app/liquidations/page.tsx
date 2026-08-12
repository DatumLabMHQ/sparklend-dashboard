"use client"

import { useState, useMemo } from "react"
import { LiquidationBarChart } from "@/components/liquidations/liquidation-bar-chart"
import { LiquidationDistribution } from "@/components/liquidations/liquidation-distribution"
import { LiquidationEvents } from "@/components/liquidations/liquidation-events"
import { LiquidatorTable } from "@/components/liquidations/liquidator-table"
import { formatUSD, getTokenName } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"

type Tab = "overview" | "liquidators"
type Period = "W" | "M" | "Q" | "Y" | "All"

// Loose type - the child components have their own stricter shapes.
type LiquidationEvent = {
  timestamp: number
  collateralAsset: string
  debtAsset: string
  collateralSeizedUSD: number
  debtRepaidUSD?: number
  liquidator?: string
  profit?: number
  [key: string]: any
}

const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "W", label: "W", days: 7 },
  { key: "M", label: "M", days: 30 },
  { key: "Q", label: "Q", days: 90 },
  { key: "Y", label: "Y", days: 365 },
  { key: "All", label: "All", days: null },
]

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-32 bg-card-bg rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card-bg border border-card-border rounded" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-[280px] bg-card-bg border border-card-border rounded" />
        <div className="h-[280px] bg-card-bg border border-card-border rounded" />
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ backgroundColor: color }} />
      <span
        className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-lg font-semibold text-text-primary tabular-nums block pl-2">{value}</span>
      {sub && <span className="text-[9px] text-text-muted mt-0.5 block pl-2">{sub}</span>}
    </div>
  )
}

function PeriodSelector({
  selected,
  onChange,
}: {
  selected: Period
  onChange: (p: Period) => void
}) {
  return (
    <div className="inline-flex rounded-sm border border-card-border overflow-hidden">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className="px-2.5 py-0.5 text-[10px] uppercase tracking-[0.05em] transition-colors"
          style={{
            background: selected === p.key ? "var(--accent)" : "transparent",
            color: selected === p.key ? "#0B0D11" : "var(--text-muted)",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

export default function LiquidationsPage() {
  const [tab, setTab] = useState<Tab>("overview")
  const [period, setPeriod] = useState<Period>("M")
  const { data: rawData, loading, error } = useCachedFetch<{ events: LiquidationEvent[] }>(
    "/api/liquidations",
    { ttl: 10 * 60_000 }
  )
  const allEvents = rawData?.events || []

  // Filter events by period
  const events = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)
    if (!p?.days) return allEvents
    const cutoff = Math.floor(Date.now() / 1000) - p.days * 86400
    return allEvents.filter((e) => e.timestamp >= cutoff)
  }, [allEvents, period])

  const allAssets = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => {
      set.add(e.collateralAsset)
      set.add(e.debtAsset)
    })
    return Array.from(set).sort()
  }, [events])

  const stats = useMemo(() => {
    const totalLiq = events.length
    const totalUsd = events.reduce((s, e) => s + (e.collateralSeizedUSD || 0), 0)
    const byAsset = new Map<string, number>()
    for (const e of events) {
      byAsset.set(e.collateralAsset, (byAsset.get(e.collateralAsset) || 0) + (e.collateralSeizedUSD || 0))
    }
    let topAsset: [string, number] | null = null
    for (const entry of byAsset.entries()) {
      if (!topAsset || entry[1] > topAsset[1]) topAsset = entry
    }
    return { totalLiq, totalUsd, topAsset }
  }, [events])

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

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Liquidations</h2>
        <span className="text-[10px] text-text-muted">— Protocol liquidation activity</span>
        <div className="flex-1 h-px bg-card-border" />
        <PeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-0 border-b border-card-border">
        {([
          ["overview", "Overview"],
          ["liquidators", "Liquidators"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors relative ${
              tab === key ? "text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
            {tab === key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Metric tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile
              label="Total Liquidations"
              value={stats.totalLiq.toLocaleString()}
              sub={period === "All" ? "all-time count" : `last ${period === "W" ? "7" : period === "M" ? "30" : period === "Q" ? "90" : "365"} days`}
              color="#a855f7"
            />
            <StatTile
              label="Total Liquidated"
              value={formatUSD(stats.totalUsd)}
              sub="collateral seized (USD)"
              color="#F59E0B"
            />
            <StatTile
              label="Most Liquidated Asset"
              value={stats.topAsset ? getTokenName(stats.topAsset[0]) : "—"}
              sub={stats.topAsset ? formatUSD(stats.topAsset[1]) : ""}
              color="#FF6B35"
            />
          </div>

          {/* Bar Chart + Distribution Donut side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LiquidationBarChart events={events as any} />
            <LiquidationDistribution events={events as any} />
          </div>

          {/* Events Table */}
          <LiquidationEvents events={events as any} allAssets={allAssets} />
        </>
      )}

      {tab === "liquidators" && <LiquidatorTable events={events as any} />}
    </div>
  )
}
