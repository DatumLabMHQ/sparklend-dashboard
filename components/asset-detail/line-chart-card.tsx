"use client"

import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { TimeToggle } from "@/components/time-toggle"
import { formatPercent } from "@/lib/utils"
import { ChartCard } from "@/components/chart-card"
import { useThemeColors } from "@/components/theme-provider"

interface LineConfig {
  dataKey: string
  color: string
  label: string
}

interface LineChartCardProps {
  title: string
  subtitle?: string
  data30d: any[]
  data90d: any[]
  lines: LineConfig[]
  yAxisFormat?: (v: number) => string
  referenceY?: number
  referenceYColor?: string
}

function ChartTooltip({ active, payload, lines }: any) {
  if (!active || !payload?.length) return null
  const dp = payload[0]?.payload
  if (!dp) return null

  return (
    <div className="custom-tooltip min-w-[160px]">
      <p className="text-xs text-text-muted mb-1.5">{dp.date}</p>
      {lines.map((line: LineConfig) => (
        <div key={line.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            <span className="text-xs text-text-secondary">{line.label}</span>
          </div>
          <span className="text-xs font-medium text-text-primary">
            {dp[line.dataKey] != null ? formatPercent(dp[line.dataKey]) : "N/A"}
          </span>
        </div>
      ))}
    </div>
  )
}

export function LineChartCard({
  title,
  subtitle,
  data30d,
  data90d,
  lines,
  yAxisFormat,
  referenceY,
  referenceYColor,
}: LineChartCardProps) {
  const colors = useThemeColors()
  const [days, setDays] = useState(30)
  const data = days === 30 ? data30d : data90d

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      actions={<div className="mr-2"><TimeToggle selected={days} onChange={setDays} /></div>}
      heightClass="h-[260px]"
    >
      {/* Legend */}
      {lines.length > 1 && (
        <div className="flex items-center gap-4 px-1 mb-1">
          {lines.map((line) => (
            <div key={line.dataKey} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              <span className="text-[10px] text-text-muted">{line.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className={`w-full ${lines.length > 1 ? "h-[calc(100%-20px)]" : "h-full"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={yAxisFormat || ((v) => formatPercent(v))}
              width={50}
            />
            <Tooltip content={<ChartTooltip lines={lines} />} cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }} />
            {referenceY !== undefined && (
              <ReferenceLine
                y={referenceY}
                stroke={referenceYColor || "#ef4444"}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
