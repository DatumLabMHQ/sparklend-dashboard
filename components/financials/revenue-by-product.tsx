"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from "recharts"
import { formatUSD } from "@/lib/utils"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"

interface MonthRow {
  month: string
  products: Record<string, { gross: number; net: number }>
  netTotal: number
}

/** Order matters: this is the order they stack, largest and steadiest first. */
const PRODUCTS: Array<{ key: string; label: string; color: string }> = [
  { key: "Distribution Rewards", label: "Distribution Rewards", color: "#A855F7" },
  { key: "SLL", label: "Liquidity Layer", color: "#F5A623" },
  { key: "SparkLend", label: "SparkLend", color: "#3B82F6" },
  { key: "Curation Fees", label: "Curation Fees", color: "#22C55E" },
]

function label(m: string) {
  const [y, mm] = m.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[Number(mm) - 1]} '${y.slice(2)}`
}

function ChartTooltip({ active, payload, label: lbl }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div className="custom-tooltip min-w-[210px]">
      <p className="text-xs text-text-muted mb-1.5">{lbl}</p>
      {payload
        .slice()
        .reverse()
        .map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-xs text-text-secondary">{p.name}</span>
            <span className="text-xs font-medium" style={{ color: p.value < 0 ? "var(--danger)" : p.color }}>
              {formatUSD(p.value)}
            </span>
          </div>
        ))}
      <div
        className="flex items-center justify-between gap-4 mt-1 pt-1"
        style={{ borderTop: "1px solid var(--card-border)" }}
      >
        <span className="text-xs text-text-secondary">Net revenue</span>
        <span className="text-xs font-semibold text-text-primary">{formatUSD(total)}</span>
      </div>
    </div>
  )
}

/**
 * Where Spark's net revenue actually comes from.
 *
 * The point of the chart is that Distribution Rewards, a payment from Sky rather
 * than anything Spark's products earn, is usually the largest single component,
 * and in several months the Liquidity Layer contributes a negative amount.
 * Negative bars stack below the axis, which is the honest way to show it.
 */
export function RevenueByProduct({ monthly, partialMonth }: { monthly: MonthRow[]; partialMonth?: boolean }) {
  const colors = useThemeColors()

  const data = useMemo(
    () =>
      monthly.map((m) => {
        const row: Record<string, any> = { label: label(m.month), month: m.month, net: m.netTotal }
        for (const p of PRODUCTS) row[p.key] = m.products[p.key]?.net ?? 0
        return row
      }),
    [monthly]
  )

  const latest = monthly[monthly.length - 1]
  const drShare =
    latest && latest.netTotal !== 0
      ? ((latest.products["Distribution Rewards"]?.net ?? 0) / latest.netTotal) * 100
      : null
  const negativeMonths = monthly.filter((m) => (m.products.SLL?.net ?? 0) < 0).length

  return (
    <ChartFrame
      title="Where the revenue comes from"
      subtitle="Net revenue by product, monthly"
      units="USD"
      source="data.spark.finance (Block Analitica)"
      height={330}
      methodology={
        <>
          Each product&apos;s net contribution, after its own costs. The Liquidity Layer is shown
          net of what Sky charges to fund it, so it prints negative in months where the funding
          cost exceeded what the book earned. Distribution Rewards are a payment from Sky under
          the Agent Framework rather than revenue Spark&apos;s products generate, which is why
          separating them matters.
        </>
      }
      footnote={
        <>
          {drShare !== null && (
            <>
              Distribution Rewards were <strong>{drShare.toFixed(0)}%</strong> of net revenue in
              the latest month.{" "}
            </>
          )}
          The Liquidity Layer contributed a <strong>negative</strong> amount in{" "}
          <strong>{negativeMonths}</strong> of {monthly.length} months shown.
          {partialMonth ? " The most recent month is still accruing." : ""}
        </>
      }
    >
      <div style={{ height: 330, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={330}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
            <CartesianGrid stroke={colors.cardBorder} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: colors.textMuted }}
              axisLine={false}
              tickLine={false}
              minTickGap={12}
            />
            <YAxis
              tick={{ fontSize: 10, fill: colors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={58}
              tickFormatter={(v: number) => formatUSD(v)}
            />
            <ReferenceLine y={0} stroke={colors.textMuted} strokeWidth={0.6} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
              iconType="square"
              iconSize={8}
            />
            {PRODUCTS.map((p) => (
              <Bar
                key={p.key}
                dataKey={p.key}
                name={p.label}
                stackId="net"
                fill={p.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
