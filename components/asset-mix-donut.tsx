"use client"

import { useMemo, useState } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD, getTokenColor, getTokenName } from "@/lib/utils"

const SMALL_SLICE_PCT = 2

type Period = "Current" | "W" | "M" | "Q"
const PERIODS: Period[] = ["Current", "W", "M", "Q"]

interface DailySnapshot {
  date: number
  tokens: Record<string, number>
}

interface Slice {
  name: string
  symbol: string
  value: number
  color: string
}

function summarize(
  tokens: Record<string, number>,
  accentToken: string,
  mutedColor: string
): { slices: Slice[]; total: number } {
  const entries = Object.entries(tokens)
    .map(([symbol, value]) => ({ symbol, value: value || 0 }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = entries.reduce((s, e) => s + e.value, 0)
  const big: typeof entries = []
  let smallSum = 0
  for (const e of entries) {
    const pct = total > 0 ? (e.value / total) * 100 : 0
    if (pct >= SMALL_SLICE_PCT) big.push(e)
    else smallSum += e.value
  }
  const slices: Slice[] = big.map((e, i) => ({
    name: getTokenName(e.symbol),
    symbol: e.symbol,
    value: e.value,
    color:
      e.symbol.toUpperCase() === accentToken
        ? "#FF6B35"
        : getTokenColor(i + 1),
  }))
  if (smallSum > 0) {
    slices.push({ name: "Other", symbol: "OTHER", value: smallSum, color: mutedColor })
  }
  return { slices, total }
}

/** Average per-token USD over the trailing N days (or take latest if N=1). */
function windowAverage(
  snapshots: DailySnapshot[],
  days: number
): Record<string, number> {
  if (snapshots.length === 0) return {}
  if (days <= 1) return snapshots[snapshots.length - 1]?.tokens || {}
  const trailing = snapshots.slice(-days)
  const sums: Record<string, number> = {}
  const denom = trailing.length
  for (const snap of trailing) {
    for (const [k, v] of Object.entries(snap.tokens)) {
      sums[k] = (sums[k] || 0) + (v || 0)
    }
  }
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(sums)) out[k] = v / denom
  return out
}

interface AssetMixDonutProps {
  title: string
  subtitle?: string
  /** Daily snapshots feeding the period-averaged view. */
  snapshots: DailySnapshot[]
  /** Uppercase symbol that gets Spark-orange highlight. */
  accentToken: string
  /** Optional footnote (JSX). */
  footnote?: React.ReactNode
  /** Methodology tooltip text. */
  methodology?: React.ReactNode
  /** Whether the total is supply, borrow, etc — used in the header label. */
  totalLabel?: string
}

export function AssetMixDonut({
  title,
  subtitle,
  snapshots,
  accentToken,
  footnote,
  methodology,
  totalLabel = "Total",
}: AssetMixDonutProps) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("Current")

  const displayTokens = useMemo(() => {
    const daysMap: Record<Period, number> = { Current: 1, W: 7, M: 30, Q: 90 }
    return windowAverage(snapshots, daysMap[period])
  }, [snapshots, period])

  const { slices, total } = useMemo(
    () => summarize(displayTokens, accentToken.toUpperCase(), colors.textMuted),
    [displayTokens, accentToken, colors.textMuted]
  )

  const topSlice = slices[0]
  const topPct = total > 0 && topSlice ? (topSlice.value / total) * 100 : 0

  const actions = (
    <div className="inline-flex rounded-sm border border-card-border overflow-hidden">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className="px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] transition-colors"
          style={{
            background: period === p ? "var(--accent)" : "transparent",
            color: period === p ? "#0B0D11" : "var(--text-muted)",
          }}
        >
          {p === "Current" ? "Now" : p}
        </button>
      ))}
    </div>
  )

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      units={period === "Current" ? "USD (latest snapshot)" : `USD (${period} avg)`}
      source="DefiLlama /protocol/sparklend — Ethereum tokensInUsd"
      methodology={methodology}
      actions={actions}
      height={340}
      footnote={
        footnote || (
          <span>
            Top asset: <strong>{topSlice?.name ?? "—"}</strong>{" "}
            ({topPct.toFixed(1)}%) of {formatUSD(total)} {totalLabel.toLowerCase()}.
          </span>
        )
      }
    >
      <div style={{ height: 300 }} className="w-full px-2 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-2 flex items-center gap-2">
          <span>{totalLabel}</span>
          <span className="text-text-primary font-medium tabular-nums normal-case tracking-normal">
            {formatUSD(total)}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-1/2 h-full min-w-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={1}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.symbol} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload
                    const pct = total > 0 ? (p.value / total) * 100 : 0
                    return (
                      <div className="custom-tooltip min-w-[160px]">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">{p.name}</span>
                          <span className="font-semibold text-text-primary">
                            {formatUSD(p.value)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs mt-0.5">
                          <span className="text-text-muted">Share</span>
                          <span className="text-text-muted">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-1">
            {slices.map((s) => {
              const pct = total > 0 ? (s.value / total) * 100 : 0
              return (
                <div
                  key={s.symbol}
                  className="flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-text-secondary truncate">{s.name}</span>
                  </div>
                  <span className="text-text-muted tabular-nums text-[10px] shrink-0">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ChartFrame>
  )
}
