"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatUSD } from "@/lib/utils"
import { PeriodToggle, type Period } from "./period-toggle"
import { aggregateData } from "./aggregate"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"

const METHODOLOGY = `Total Interest Accrued represents the gross interest generated across all SparkLend lending markets before any splits.

When borrowers take loans, they pay variable interest rates that accrue continuously. This metric captures the total value of that interest.

The split toggle shows how this interest is distributed:

Lender Share (Supply-Side Revenue): The portion of interest paid directly to liquidity providers who deposited assets. This is determined as (1 - Reserve Factor) of total interest.

Protocol Share (Protocol Revenue): The portion retained by the SparkLend treasury, determined by each asset's Reserve Factor (e.g., 10-20% depending on the asset).

Data sourced from DefiLlama's fee tracking infrastructure which indexes on-chain accrual events.`

interface InterestChartProps {
  daily: Array<{ date: number; totalFees: number; revenue: number; supplySideRevenue: number }>
}

function ChartTooltip({ active, payload, label, showSplit }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="custom-tooltip min-w-[180px]">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      {showSplit ? (
        <>
          {payload.map((item: any) => (
            <div key={item.dataKey} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-xs text-text-secondary">
                  {item.dataKey === "supplySideRevenue" ? "Lender Share" : "Protocol Share"}
                </span>
              </div>
              <span className="text-xs font-medium text-text-primary">{formatUSD(item.value)}</span>
            </div>
          ))}
          <div className="border-t border-card-border mt-1 pt-1 flex justify-between">
            <span className="text-xs text-text-secondary">Total</span>
            <span className="text-xs font-semibold text-text-primary">
              {formatUSD(payload.reduce((s: number, p: any) => s + p.value, 0))}
            </span>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-text-secondary">Total Interest</span>
          <span className="text-xs font-medium text-text-primary">{formatUSD(payload[0]?.value || 0)}</span>
        </div>
      )}
    </div>
  )
}

export function InterestChart({ daily }: InterestChartProps) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("W")
  const [showSplit, setShowSplit] = useState(false)

  const chartData = useMemo(
    () => aggregateData(daily, period, ["totalFees", "revenue", "supplySideRevenue"]),
    [daily, period]
  )

  const chartActions = <PeriodToggle selected={period} onChange={setPeriod} />

  return (
    <ChartFrame
      title="Total Interest Accrued"
      subtitle="Gross interest generated across all SparkLend markets, with optional Lender / Protocol split"
      units="USD"
      methodology={METHODOLOGY}
      actions={chartActions}
      height={280}
    >
      <div className="flex items-center gap-3 px-1 mb-2 mt-1">
        <button
          onClick={() => setShowSplit(false)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${!showSplit ? "opacity-100" : "opacity-40"}`}
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
          <span className="text-text-secondary">Total</span>
        </button>
        <button
          onClick={() => setShowSplit(true)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${showSplit ? "opacity-100" : "opacity-40"}`}
        >
          <span className="flex gap-0.5">
            <span className="w-1.5 h-2.5 rounded-sm bg-[#22c55e]" />
            <span className="w-1.5 h-2.5 rounded-sm bg-[#FF6B35]" />
          </span>
          <span className="text-text-secondary">Lender / Protocol Split</span>
        </button>
      </div>

      <div style={{ height: 240 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: colors.textMuted }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textMuted }} tickFormatter={(v) => formatUSD(v)} width={55} />
            <Tooltip content={<ChartTooltip showSplit={showSplit} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            {showSplit ? (
              <>
                <Bar dataKey="supplySideRevenue" stackId="1" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="revenue" stackId="1" fill="#FF6B35" radius={[2, 2, 0, 0]} />
              </>
            ) : (
              <Bar dataKey="totalFees" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
