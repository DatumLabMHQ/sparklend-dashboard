"use client"

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts"
import { formatPercent } from "@/lib/utils"
import { ChartCard } from "@/components/chart-card"
import { useThemeColors } from "@/components/theme-provider"

interface InterestRateCurveProps {
  baseRate: number
  slope1: number
  slope2: number
  optimalUtilization: number
  currentUtilization: number
  reserveFactor: number
}

function CurveTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const dp = payload[0]?.payload
  if (!dp) return null

  return (
    <div className="custom-tooltip min-w-[180px]">
      <p className="text-xs text-text-muted mb-1.5">
        Utilization: {formatPercent(dp.utilization)}
      </p>
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-xs text-text-secondary">Borrow Rate</span>
        </div>
        <span className="text-xs font-medium text-text-primary">
          {formatPercent(dp.borrowRate)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs text-text-secondary">Supply Rate</span>
        </div>
        <span className="text-xs font-medium text-text-primary">
          {formatPercent(dp.supplyRate)}
        </span>
      </div>
    </div>
  )
}

export function InterestRateCurve({
  baseRate,
  slope1,
  slope2,
  optimalUtilization,
  currentUtilization,
  reserveFactor,
}: InterestRateCurveProps) {
  const colors = useThemeColors()
  // Generate 101 data points (0% to 100%)
  const kink = optimalUtilization
  const rfFactor = 1 - reserveFactor / 100

  const curveData = Array.from({ length: 101 }, (_, i) => {
    const u = i // utilization %
    let borrowRate: number
    if (u <= kink) {
      borrowRate = baseRate + (u / kink) * slope1
    } else {
      borrowRate = baseRate + slope1 + ((u - kink) / (100 - kink)) * slope2
    }
    const supplyRate = borrowRate * (u / 100) * rfFactor

    return {
      utilization: u,
      borrowRate: Math.max(0, borrowRate),
      supplyRate: Math.max(0, supplyRate),
    }
  })

  const legendActions = (
    <div className="flex items-center gap-4 mr-2">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-accent" />
        <span className="text-[10px] text-text-muted">Borrow Rate</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-success" />
        <span className="text-[10px] text-text-muted">Supply Rate</span>
      </div>
    </div>
  )

  return (
    <ChartCard title="Interest Rate Curve" actions={legendActions}>
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={curveData} margin={{ top: 20, right: 15, left: 5, bottom: 0 }}>
            <XAxis
              dataKey="utilization"
              type="number"
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={(v) => `${v}%`}
              ticks={[0, 25, 50, 75, 100]}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={(v) => formatPercent(v)}
              width={55}
            />
            <Tooltip content={<CurveTooltip />} cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }} />

            {/* Kink reference line - dotted vertical */}
            <ReferenceLine
              x={Math.round(kink)}
              stroke="#ef4444"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Kink (${formatPercent(kink)})`,
                position: "top",
                fill: "#ef4444",
                fontSize: 10,
                fontWeight: 500,
              }}
            />

            {/* Current utilization reference line - dotted vertical */}
            <ReferenceLine
              x={Math.round(currentUtilization)}
              stroke="#FF6B35"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Current (${formatPercent(currentUtilization)})`,
                position: "insideTopLeft",
                fill: "#FF6B35",
                fontSize: 10,
                fontWeight: 500,
              }}
            />

            <Line
              type="monotone"
              dataKey="borrowRate"
              stroke="#FF6B35"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="supplyRate"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
