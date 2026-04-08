"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatUSD } from "@/lib/utils"
import { PeriodToggle, type Period } from "./period-toggle"
import { aggregateData } from "./aggregate"
import { MethodologyTooltip } from "./methodology-tooltip"
import { ChartCard } from "@/components/chart-card"
import { useThemeColors } from "@/components/theme-provider"

const METHODOLOGY = `SparkLend Revenue represents the total protocol income decomposed into three streams:

Net Interest Income: The protocol treasury's share of borrower interest payments, determined by each asset's Reserve Factor. When borrowers pay interest, a portion goes to lenders (supply-side) and the remainder accrues to the protocol.

Flashloan Fees: Premiums collected from flash loan operations. Flash loans allow uncollateralized borrowing within a single transaction; the premium (typically 0.05%) is split between the protocol and liquidity providers.

Liquidation Fees: The protocol's share of liquidation penalties. When undercollateralized positions are liquidated, the liquidation bonus (varies by asset, e.g. 5-10%) compensates the liquidator, with ~10% of that bonus allocated to the protocol treasury.

Data is sourced from DefiLlama (daily fee aggregates) combined with on-chain event scanning for per-category breakdown.`

interface RevenueChartProps {
  daily: Array<{ date: number; netInterestIncome: number; flashloanFees: number; liquidationFees: number }>
}

const STREAMS = [
  { key: "netInterestIncome", label: "Net Interest Income", color: "#22c55e" },
  { key: "flashloanFees", label: "Flashloan Fees", color: "#8b5cf6" },
  { key: "liquidationFees", label: "Liquidation Fees", color: "#FF6B35" },
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p: any) => p.value > 0)
  const total = items.reduce((s: number, p: any) => s + p.value, 0)

  return (
    <div className="custom-tooltip min-w-[200px]">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      {items.map((item: any) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill || item.color }} />
            <span className="text-xs text-text-secondary">{STREAMS.find((s) => s.key === item.dataKey)?.label || item.dataKey}</span>
          </div>
          <span className="text-xs font-medium text-text-primary">{formatUSD(item.value)}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div className="border-t border-card-border mt-1 pt-1 flex justify-between">
          <span className="text-xs text-text-secondary">Total</span>
          <span className="text-xs font-semibold text-text-primary">{formatUSD(total)}</span>
        </div>
      )}
    </div>
  )
}

export function RevenueChart({ daily }: RevenueChartProps) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("M")
  const [visible, setVisible] = useState<Record<string, boolean>>({
    netInterestIncome: true,
    flashloanFees: true,
    liquidationFees: true,
  })

  const chartData = useMemo(
    () => aggregateData(daily, period, STREAMS.map((s) => s.key)),
    [daily, period]
  )

  const toggleStream = (key: string) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }))
  }

  const chartActions = (
    <div className="flex items-center gap-2 mr-2">
      <MethodologyTooltip text={METHODOLOGY} />
      <PeriodToggle selected={period} onChange={setPeriod} />
    </div>
  )

  return (
    <ChartCard title="SparkLend Revenue" subtitle="Revenue breakdown by stream" actions={chartActions}>
      {/* Stream toggles */}
      <div className="flex items-center gap-4 px-1 mb-2">
        {STREAMS.map((s) => (
          <button
            key={s.key}
            onClick={() => toggleStream(s.key)}
            className={`flex items-center gap-1.5 text-xs transition-opacity ${visible[s.key] ? "opacity-100" : "opacity-40"}`}
          >
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-text-secondary">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="h-[calc(100%-28px)] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: colors.textMuted }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textMuted }} tickFormatter={(v) => formatUSD(v)} width={60} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            {STREAMS.map(
              (s) =>
                visible[s.key] && (
                  <Bar key={s.key} dataKey={s.key} stackId="1" fill={s.color} radius={[0, 0, 0, 0]} />
                )
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
