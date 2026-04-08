"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatUSD } from "@/lib/utils"
import { PeriodToggle, type Period } from "./period-toggle"
import { aggregateData } from "./aggregate"
import { MethodologyTooltip } from "./methodology-tooltip"
import { ChartCard } from "@/components/chart-card"
import { useThemeColors } from "@/components/theme-provider"

interface FeeChartProps {
  title: string
  subtitle: string
  daily: Array<{ date: number; [key: string]: number }>
  dataKey: string
  color: string
  methodology?: string
}

function ChartTooltip({ active, payload, label, title }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip min-w-[160px]">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-text-secondary">{title}</span>
        <span className="text-xs font-medium text-text-primary">{formatUSD(payload[0]?.value || 0)}</span>
      </div>
    </div>
  )
}

export function FeeChart({ title, subtitle, daily, dataKey, color, methodology }: FeeChartProps) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("M")

  const chartData = useMemo(
    () => aggregateData(daily, period, [dataKey]),
    [daily, period, dataKey]
  )

  const chartActions = (
    <div className="flex items-center gap-2 mr-2">
      {methodology && <MethodologyTooltip text={methodology} />}
      <PeriodToggle selected={period} onChange={setPeriod} />
    </div>
  )

  return (
    <ChartCard title={title} subtitle={subtitle} actions={chartActions} heightClass="h-[220px]">
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: colors.textMuted }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textMuted }} tickFormatter={(v) => formatUSD(v)} width={55} />
            <Tooltip content={<ChartTooltip title={title} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
