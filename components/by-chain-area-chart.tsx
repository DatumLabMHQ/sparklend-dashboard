"use client"

import { useState, useMemo, type ReactNode } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD } from "@/lib/utils"

const CHAIN_COLORS: Record<string, string> = {
  Ethereum: "#5B7FFF",
  Arbitrum: "#28A0F0",
  Base: "#0052FF",
  Optimism: "#FF0420",
  Unichain: "#FF00A8",
  Avalanche: "#E84142",
  "X Layer": "#000000",
  "Robinhood Chain": "#0EC94A",
}

// Fallback palette for chains not in the map above.
const FALLBACK_COLORS = ["#FF6B35", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899"]

function bucket(
  daily: Array<Record<string, number>>,
  chains: string[],
  period: "W" | "M" | "Q"
): Array<Record<string, any>> {
  const groups = new Map<string, { count: number; sums: Record<string, number> }>()
  const order: string[] = []
  const keyFn = (ts: number) => {
    const d = new Date(ts * 1000)
    if (period === "W") {
      const jan1 = new Date(d.getUTCFullYear(), 0, 1)
      const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
      return `W${week} ${d.getUTCFullYear()}`
    }
    if (period === "M")
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    const q = Math.ceil((d.getUTCMonth() + 1) / 3)
    return `Q${q} ${d.getUTCFullYear()}`
  }
  for (const p of daily) {
    const k = keyFn(p.date)
    if (!groups.has(k)) {
      groups.set(k, { count: 0, sums: Object.fromEntries(chains.map((c) => [c, 0])) })
      order.push(k)
    }
    const g = groups.get(k)!
    g.count++
    for (const c of chains) g.sums[c] += p[c] || 0
  }
  // Drop the trailing partial-period bucket.
  let out = order
  const nowKey = keyFn(Math.floor(Date.now() / 1000))
  if (out.length > 0 && out[out.length - 1] === nowKey) {
    out = out.slice(0, -1)
  }
  return out.map((k) => {
    const g = groups.get(k)!
    const row: Record<string, any> = { label: k }
    for (const c of chains) row[c] = g.sums[c] / g.count
    return row
  })
}

export interface ByChainAreaChartProps {
  title: string
  subtitle?: string
  methodology?: ReactNode
  footnote?: ReactNode
  source?: string
  chains: string[]
  daily: Array<Record<string, number>>
  height?: number
}

export function ByChainAreaChart({
  title,
  subtitle,
  methodology,
  footnote,
  source,
  chains,
  daily,
  height = 300,
}: ByChainAreaChartProps) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<"W" | "M" | "Q">("W")
  const [mode, setMode] = useState<"usd" | "pct">("usd")

  const rawBucketed = useMemo(
    () => bucket(daily, chains, period),
    [daily, chains, period]
  )

  const data = useMemo(() => {
    if (mode === "usd") return rawBucketed
    return rawBucketed.map((r) => {
      const total = chains.reduce((s, c) => s + (r[c] || 0), 0)
      if (total === 0) return r
      const out: Record<string, any> = { label: r.label }
      for (const c of chains) out[c] = ((r[c] || 0) / total) * 100
      return out
    })
  }, [rawBucketed, chains, mode])

  const chainColor = (chain: string, idx: number) =>
    CHAIN_COLORS[chain] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]

  const actions = (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-sm border border-card-border overflow-hidden">
        {(["usd", "pct"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] transition-colors"
            style={{
              background: mode === m ? "var(--accent)" : "transparent",
              color: mode === m ? "#0B0D11" : "var(--text-muted)",
            }}
          >
            {m === "usd" ? "USD" : "%"}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-sm border border-card-border overflow-hidden">
        {(["W", "M", "Q"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] transition-colors"
            style={{
              background: period === p ? "var(--accent)" : "transparent",
              color: period === p ? "#0B0D11" : "var(--text-muted)",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      units={mode === "usd" ? "USD" : "% of total"}
      source={source || "DefiLlama per-chain TVL"}
      methodology={methodology}
      actions={actions}
      height={height}
      footnote={footnote}
    >
      <div style={{ height: height - 40 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              {chains.map((c, i) => (
                <linearGradient key={c} id={`by-chain-${title.replace(/\s+/g, "")}-${c}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chainColor(c, i)} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={chainColor(c, i)} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: colors.textMuted }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={(v) => (mode === "usd" ? formatUSD(v) : `${v.toFixed(0)}%`)}
              width={mode === "usd" ? 60 : 40}
              domain={mode === "pct" ? [0, 100] : undefined}
            />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                const items = payload
                  .filter((p: any) => p.value > 0)
                  .sort((a: any, b: any) => b.value - a.value)
                const total = items.reduce((s: number, p: any) => s + p.value, 0)
                return (
                  <div className="custom-tooltip min-w-[200px]">
                    <p className="text-xs text-text-muted mb-1.5">{label}</p>
                    {items.map((it: any) => (
                      <div key={it.dataKey} className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: it.stroke || it.fill }}
                          />
                          <span className="text-xs text-text-secondary">{it.dataKey}</span>
                        </div>
                        <span className="text-xs font-medium text-text-primary">
                          {mode === "usd" ? formatUSD(it.value) : `${it.value.toFixed(1)}%`}
                        </span>
                      </div>
                    ))}
                    {mode === "usd" && (
                      <div className="border-t border-card-border mt-1 pt-1 flex justify-between">
                        <span className="text-xs text-text-secondary">Total</span>
                        <span className="text-xs font-semibold text-text-primary">
                          {formatUSD(total)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              }}
              cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            {chains.map((c, i) => (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                stackId="1"
                stroke={chainColor(c, i)}
                strokeWidth={0.5}
                fill={`url(#by-chain-${title.replace(/\s+/g, "")}-${c})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
