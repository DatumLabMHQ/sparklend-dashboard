"use client"

import { useState, useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts"
import { formatUSD, formatPercent, getTokenColor } from "@/lib/utils"
import { TokenIcon } from "@/components/token-icon"
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

function createActiveShapeRenderer(themeColors: { textPrimary: string; textSecondary: string }) {
  return function renderActiveShape(props: any) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props
    return (
      <g>
        <text x={cx} y={cy - 6} textAnchor="middle" fill={themeColors.textPrimary} fontSize={12} fontWeight={600}>{payload.symbol}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill={themeColors.textSecondary} fontSize={10}>{formatPercent(payload.percentage, 1)}</text>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 4} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      </g>
    )
  }
}

export function LiquidationDistribution({ events }: { events: LiquidationEvent[] }) {
  const colors = useThemeColors()
  const [days, setDays] = useState(30)
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const renderActiveShape = useMemo(() => createActiveShapeRenderer(colors), [colors])

  const data = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - days * 86400
    const filtered = events.filter((e) => e.timestamp >= cutoff)

    const totals = new Map<string, number>()
    for (const e of filtered) {
      totals.set(e.collateralAsset, (totals.get(e.collateralAsset) || 0) + e.collateralSeizedUSD)
    }

    const grandTotal = Array.from(totals.values()).reduce((s, v) => s + v, 0)
    return Array.from(totals.entries())
      .map(([symbol, valueUSD]) => ({
        symbol,
        valueUSD,
        percentage: grandTotal > 0 ? (valueUSD / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.valueUSD - a.valueUSD)
  }, [events, days])

  return (
    <ChartCard
      title="Liquidation Distribution"
      subtitle={`Collateral distribution, last ${days}d`}
      actions={<div className="mr-2"><DayToggle selected={days} onChange={setDays} /></div>}
      heightClass="h-auto"
    >
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-xs text-text-muted">No liquidations in this period</p>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <div className="w-[160px] h-[160px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="valueUSD" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={1} activeIndex={activeIndex} activeShape={renderActiveShape} onMouseEnter={(_, i) => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(undefined)}>
                  {data.map((entry, i) => (
                    <Cell key={entry.symbol} fill={getTokenColor(i)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-[200px] overflow-y-auto content-start">
            {data.map((entry, i) => (
              <div key={entry.symbol} className="flex items-center gap-1.5" onMouseEnter={() => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(undefined)}>
                <TokenIcon symbol={entry.symbol} size={16} />
                <span className="text-[11px] text-text-secondary">{entry.symbol}</span>
                <span className="text-[11px] font-medium text-text-primary ml-auto">{formatUSD(entry.valueUSD)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  )
}
