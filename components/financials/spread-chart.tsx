"use client"

import { useMemo } from "react"
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"

interface Day {
  date: string
  baseRatePct: number
  realApyPct: number
  spreadPct: number
  totalAssetsUsd: number
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as Day
  return (
    <div className="custom-tooltip min-w-[210px]">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-text-secondary">Assets earn</span>
        <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
          {d.realApyPct.toFixed(3)}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-text-secondary">Paid to Sky</span>
        <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
          {d.baseRatePct.toFixed(3)}%
        </span>
      </div>
      <div
        className="flex items-center justify-between gap-4 mt-1 pt-1"
        style={{ borderTop: "1px solid var(--card-border)" }}
      >
        <span className="text-xs text-text-secondary">Spark keeps</span>
        <span className="text-xs font-semibold text-text-primary">{d.spreadPct.toFixed(4)}%</span>
      </div>
    </div>
  )
}

/**
 * The margin, daily. Two rates and the gap between them.
 *
 * This is the chart that explains Spark. The business is borrowing from Sky at
 * one rate and deploying at another, and the entire profit is the distance
 * between these two lines. When they converge there is no business, which is
 * what happened through the second half of August 2026.
 */
export function SpreadChart({ daily }: { daily: Day[] }) {
  const colors = useThemeColors()

  const data = useMemo(
    () =>
      daily
        // The first rows of the window are bootstrap days where the series has
        // not started and both rates read ~0. Left in, they drag the axis to
        // zero and flatten the part of the chart that matters.
        .filter((d) => d.baseRatePct > 0.5 && d.realApyPct > 0.5)
        .map((d) => ({
          ...d,
          label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        })),
    [daily]
  )

  const now = data[data.length - 1]

  // Percentile bounds rather than min/max, so one spike does not squash a chart
  // whose whole subject is a gap of a few tenths of a percent.
  const domain = useMemo<[number, number]>(() => {
    const vals = data.flatMap((d) => [d.baseRatePct, d.realApyPct]).sort((a, b) => a - b)
    if (!vals.length) return [0, 6]
    const at = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))]
    const lo = at(0.01)
    const hi = at(0.99)
    const pad = Math.max(0.12, (hi - lo) * 0.18)
    return [Math.max(0, lo - pad), hi + pad]
  }, [data])

  return (
    <ChartFrame
      title="What Spark earns against what it pays"
      subtitle="Liquidity Layer asset yield vs cost of capital, daily"
      units="%"
      source="data.spark.finance (Block Analitica)"
      height={300}
      methodology={
        <>
          Spark borrows from Sky and redeploys the money. The green line is what the deployed
          assets earn, the red line is what Sky charges. Everything Spark keeps is the gap
          between them. Because that gap is currently a fraction of a percent on billions of
          dollars, small moves in either line change profitability entirely.
        </>
      }
      footnote={
        now ? (
          <>
            Latest: assets earn <strong>{now.realApyPct.toFixed(2)}%</strong>, Sky charges{" "}
            <strong>{now.baseRatePct.toFixed(2)}%</strong>, Spark keeps{" "}
            <strong>{now.spreadPct.toFixed(3)}%</strong> on{" "}
            <strong>${(now.totalAssetsUsd / 1e9).toFixed(2)}B</strong> of total assets.
          </>
        ) : undefined
      }
    >
      {/* ChartFrame's body sets min-height, not height, so a percentage height
          on ResponsiveContainer resolves against an auto-height parent and
          collapses to 0. Give it an explicit box. */}
      <div style={{ height: 300, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spreadFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.success} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colors.success} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.cardBorder} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: colors.textMuted }}
            axisLine={false}
            tickLine={false}
            minTickGap={44}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 10, fill: colors.textMuted }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="realApyPct"
            stroke={colors.success}
            strokeWidth={1.8}
            fill="url(#spreadFill)"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="baseRatePct"
            stroke={colors.danger}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
