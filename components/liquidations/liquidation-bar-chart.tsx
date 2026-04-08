"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatUSD, getTokenColor } from "@/lib/utils"
import { ChartCard } from "@/components/chart-card"
import { useThemeColors } from "@/components/theme-provider"

interface LiquidationEvent {
  timestamp: number
  collateralAsset: string
  collateralSeizedUSD: number
}

function DayToggle({ selected, onChange }: { selected: number; onChange: (d: number) => void }) {
  return (
    <div className="flex bg-background rounded-md border border-card-border overflow-hidden">
      <button onClick={() => onChange(7)} className={`px-3 py-1 text-xs font-medium transition-colors ${selected === 7 ? "bg-card-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}>7d</button>
      <button onClick={() => onChange(30)} className={`px-3 py-1 text-xs font-medium transition-colors ${selected === 30 ? "bg-card-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}>30d</button>
      <button onClick={() => onChange(90)} className={`px-3 py-1 text-xs font-medium transition-colors ${selected === 90 ? "bg-card-border text-text-primary" : "text-text-muted hover:text-text-secondary"}`}>90d</button>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p: any) => p.value > 0).sort((a: any, b: any) => b.value - a.value)
  const total = items.reduce((s: number, p: any) => s + p.value, 0)

  return (
    <div className="custom-tooltip min-w-[180px]">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      {items.map((item: any) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
            <span className="text-xs text-text-secondary">{item.dataKey}</span>
          </div>
          <span className="text-xs font-medium text-text-primary">{formatUSD(item.value)}</span>
        </div>
      ))}
      <div className="border-t border-card-border mt-1 pt-1 flex justify-between">
        <span className="text-xs text-text-secondary">Total</span>
        <span className="text-xs font-semibold text-text-primary">{formatUSD(total)}</span>
      </div>
    </div>
  )
}

export function LiquidationBarChart({ events }: { events: LiquidationEvent[] }) {
  const colors = useThemeColors()
  const [days, setDays] = useState(30)

  const { chartData, assets } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - days * 86400
    const filtered = events.filter((e) => e.timestamp >= cutoff)

    // Group by day
    const dayMap = new Map<string, Record<string, number>>()
    const assetSet = new Set<string>()

    for (const e of filtered) {
      const day = new Date(e.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      if (!dayMap.has(day)) dayMap.set(day, {})
      const rec = dayMap.get(day)!
      rec[e.collateralAsset] = (rec[e.collateralAsset] || 0) + e.collateralSeizedUSD
      assetSet.add(e.collateralAsset)
    }

    // Sort assets by total
    const assetTotals = new Map<string, number>()
    for (const rec of dayMap.values()) {
      for (const [asset, val] of Object.entries(rec)) {
        assetTotals.set(asset, (assetTotals.get(asset) || 0) + val)
      }
    }
    const assets = Array.from(assetSet).sort((a, b) => (assetTotals.get(b) || 0) - (assetTotals.get(a) || 0))

    // Sort chronologically using timestamp-keyed approach
    const dayTimestamps = new Map<string, number>()
    for (const e of filtered) {
      const day = new Date(e.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      if (!dayTimestamps.has(day)) dayTimestamps.set(day, e.timestamp)
    }

    const chartData = Array.from(dayMap.entries())
      .sort((a, b) => (dayTimestamps.get(a[0]) || 0) - (dayTimestamps.get(b[0]) || 0))
      .map(([date, rec]) => ({ date, ...rec }))

    return { chartData, assets }
  }, [events, days])

  const colorMap: Record<string, string> = {}
  assets.forEach((a, i) => { colorMap[a] = getTokenColor(i) })

  return (
    <ChartCard
      title="Liquidations"
      subtitle={`Collateral seized, last ${days}d`}
      actions={<div className="mr-2"><DayToggle selected={days} onChange={setDays} /></div>}
      heightClass="h-[240px]"
    >
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textMuted }} interval="preserveStartEnd" minTickGap={40} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textMuted }} tickFormatter={(v) => formatUSD(v)} width={60} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            {assets.map((asset) => (
              <Bar key={asset} dataKey={asset} stackId="1" fill={colorMap[asset]} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
