"use client"

import { useState, useMemo } from "react"
import { LiquidationBarChart } from "@/components/liquidations/liquidation-bar-chart"
import { LiquidationDistribution } from "@/components/liquidations/liquidation-distribution"
import { LiquidationEvents } from "@/components/liquidations/liquidation-events"
import { LiquidatorTable } from "@/components/liquidations/liquidator-table"
import { useCachedFetch } from "@/lib/use-cached-fetch"

type Tab = "overview" | "liquidators"

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-32 bg-card-bg rounded" />
      <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
      <div className="h-[250px] bg-card-bg border border-card-border rounded-lg" />
      <div className="h-[400px] bg-card-bg border border-card-border rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card-bg border border-card-border rounded-lg" />
        ))}
      </div>
      <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
    </div>
  )
}

export default function LiquidationsPage() {
  const [tab, setTab] = useState<Tab>("overview")
  const { data: rawData, loading, error } = useCachedFetch("/api/liquidations", { ttl: 10 * 60_000 })
  const events = rawData?.events || []

  const allAssets = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e: any) => {
      set.add(e.collateralAsset)
      set.add(e.debtAsset)
    })
    return Array.from(set).sort()
  }, [events])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="text-center py-12">
          <p className="text-danger text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-card-bg border border-card-border rounded-md text-xs text-text-secondary hover:text-text-primary transition-colors">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">
          Liquidations
        </h2>
        <div className="flex-1 h-px bg-card-border" />
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
              tab === key
                ? "text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
            {tab === key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Bar Chart + Distribution Donut side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LiquidationBarChart events={events} />
            <LiquidationDistribution events={events} />
          </div>

          {/* Events Table */}
          <LiquidationEvents events={events} allAssets={allAssets} />
        </>
      )}

      {tab === "liquidators" && (
        <LiquidatorTable events={events} />
      )}

      {/* Footer */}
      <footer className="border-t border-card-border pt-4 pb-8 flex items-center justify-between">
        <p className="text-[10px] text-text-muted">
          Data sourced from SparkLend on-chain events. Updated every 30 minutes.
        </p>
        <p className="text-[10px] text-text-muted">
          Datum Labs &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
