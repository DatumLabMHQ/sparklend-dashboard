"use client"

import { useMemo } from "react"
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts"
import { formatUSD } from "@/lib/utils"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"

interface MonthRow {
  month: string
  sllGross: number
  sllNet: number
  sllCost: number
}

function label(m: string) {
  const [y, mm] = m.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[Number(mm) - 1]} '${y.slice(2)}`
}

function ChartTooltip({ active, payload, label: lbl }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="custom-tooltip min-w-[230px]">
      <p className="text-xs text-text-muted mb-1.5">{lbl}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-text-secondary">Gross yield</span>
        <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
          {formatUSD(d.gross)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-text-secondary">Funding cost</span>
        <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
          {formatUSD(d.cost)}
        </span>
      </div>
      <div
        className="flex items-center justify-between gap-4 mt-1 pt-1"
        style={{ borderTop: "1px solid var(--card-border)" }}
      >
        <span className="text-xs text-text-secondary">Kept</span>
        <span
          className="text-xs font-semibold"
          style={{ color: d.net < 0 ? "var(--danger)" : "var(--text-primary)" }}
        >
          {formatUSD(d.net)} ({d.takeRate.toFixed(1)}%)
        </span>
      </div>
    </div>
  )
}

/**
 * The squeeze, in dollars.
 *
 * Two bars almost the same height every month, and a line showing how little
 * survives between them. It is the same story as the daily spread chart but in
 * money rather than rates, which is the version most readers find legible.
 */
export function MarginChart({ monthly }: { monthly: MonthRow[] }) {
  const colors = useThemeColors()

  const data = useMemo(
    () =>
      monthly.map((m) => ({
        label: label(m.month),
        gross: m.sllGross,
        cost: -m.sllCost,
        net: m.sllNet,
        takeRate: m.sllGross > 0 ? (m.sllNet / m.sllGross) * 100 : 0,
      })),
    [monthly]
  )

  const latest = data[data.length - 1]
  const best = data.reduce((m, d) => (d.takeRate > m.takeRate ? d : m), data[0])

  return (
    <ChartFrame
      title="Gross yield against funding cost"
      subtitle="Liquidity Layer, monthly, with the share Spark keeps"
      units="USD"
      source="data.spark.finance (Block Analitica)"
      height={320}
      methodology={
        <>
          Green is what the deployed capital earned, red is what Sky charged to fund it, and the
          line is the share of gross that survived as net. The two bars are close to the same
          size every month, which is why the line moves so violently: net revenue is a small
          difference between two large numbers, so a change of a few percent in either bar
          changes the take rate by tens of percent.
        </>
      }
      footnote={
        latest && best ? (
          <>
            Latest take rate <strong>{latest.takeRate.toFixed(1)}%</strong>, against a high of{" "}
            <strong>{best.takeRate.toFixed(1)}%</strong> in {best.label}. A 1% error in the gross
            bar would move net by roughly{" "}
            <strong>{Math.abs(latest.gross / latest.net).toFixed(0)}x</strong> as much in
            percentage terms.
          </>
        ) : undefined
      }
    >
      <div style={{ height: 320, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={320}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.cardBorder} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: colors.textMuted }}
              axisLine={false}
              tickLine={false}
              minTickGap={12}
            />
            <YAxis
              yAxisId="usd"
              tick={{ fontSize: 10, fill: colors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={58}
              tickFormatter={(v: number) => formatUSD(v)}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 10, fill: colors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <ReferenceLine yAxisId="usd" y={0} stroke={colors.textMuted} strokeWidth={0.6} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar yAxisId="usd" dataKey="gross" fill={colors.success} isAnimationActive={false} />
            <Bar yAxisId="usd" dataKey="cost" fill={colors.danger} isAnimationActive={false} />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="takeRate"
              stroke={colors.accent}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
