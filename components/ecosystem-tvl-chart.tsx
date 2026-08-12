"use client"

import { useState, useMemo } from "react"
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

const METHODOLOGY = `Spark markets itself around three product lines: Savings (sUSDS deposits routed through Spark), SparkLend (the lending pool — total supplied = available liquidity + borrowed), and Spark Liquidity Layer (ALM Proxy deployments into external venues).

DefiLlama data is aggregated across every chain each product runs on (Ethereum + L2s). SparkLend's line = Ethereum TVL + Ethereum-borrowed (total supply-side value), not just available liquidity.

Q2 2026 report cited a $12.6B ecosystem = $6.4B Savings + $3.6B SparkLend + $2.6B SLL. Our chart uses DefiLlama's Spark-attributed segmentation, which is smaller for Savings — DefiLlama credits Spark only for deposits routed via Spark's UI, not the total sUSDS float that Sky's Q2 report includes.`

const STREAMS = [
  { key: "savings", label: "Savings (sUSDS via Spark)", color: "#22c55e" },
  { key: "sparklend", label: "SparkLend", color: "#3b82f6" },
  { key: "sll", label: "Spark Liquidity Layer", color: "#FF6B35" },
] as const

type Period = "W" | "M" | "Q"

interface Point {
  date: number
  savings: number
  sparklend: number
  sll: number
  total: number
}

function bucketWeekly(daily: Point[], period: Period): Array<Record<string, any>> {
  const groups = new Map<string, { total: number; savings: number; sparklend: number; sll: number; count: number; anchor: number }>()
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
    // Q
    const q = Math.ceil((d.getUTCMonth() + 1) / 3)
    return `Q${q} ${d.getUTCFullYear()}`
  }
  for (const p of daily) {
    const k = keyFn(p.date)
    if (!groups.has(k)) {
      groups.set(k, { savings: 0, sparklend: 0, sll: 0, total: 0, count: 0, anchor: p.date })
      order.push(k)
    }
    const g = groups.get(k)!
    // Average across the period (TVL is a stock, not a flow — averaging is
    // the honest bucket).
    g.savings += p.savings
    g.sparklend += p.sparklend
    g.sll += p.sll
    g.total += p.total
    g.count++
  }
  return order.map((k) => {
    const g = groups.get(k)!
    return {
      label: k,
      savings: g.savings / g.count,
      sparklend: g.sparklend / g.count,
      sll: g.sll / g.count,
      total: g.total / g.count,
    }
  })
}

function ChartTooltip({ active, payload, label, mode }: any) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p: any) => p.value > 0)
  const total = items.reduce((s: number, p: any) => s + p.value, 0)
  return (
    <div className="custom-tooltip min-w-[220px]">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      {items.map((item: any) => {
        const stream = STREAMS.find((s) => s.key === item.dataKey)
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"
        return (
          <div key={item.dataKey} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stream?.color }} />
              <span className="text-xs text-text-secondary">{stream?.label || item.dataKey}</span>
            </div>
            <span className="text-xs font-medium text-text-primary">
              {mode === "pct" ? `${pct}%` : formatUSD(item.value)}
            </span>
          </div>
        )
      })}
      <div className="border-t border-card-border mt-1 pt-1 flex justify-between">
        <span className="text-xs text-text-secondary">Total</span>
        <span className="text-xs font-semibold text-text-primary">{formatUSD(total)}</span>
      </div>
    </div>
  )
}

interface EcosystemTvlChartProps {
  daily: Point[]
  current: { savings: number; sparklend: number; sll: number; total: number }
}

export function EcosystemTvlChart({ daily, current }: EcosystemTvlChartProps) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("W")
  const [mode, setMode] = useState<"usd" | "pct">("usd")

  const raw = useMemo(() => bucketWeekly(daily, period), [daily, period])

  // For % mode, normalize each row so the streams sum to 100.
  const data = useMemo(() => {
    if (mode === "usd") return raw
    return raw.map((r) => {
      const total = (r.savings || 0) + (r.sparklend || 0) + (r.sll || 0)
      if (total === 0) return r
      return {
        ...r,
        savings: ((r.savings || 0) / total) * 100,
        sparklend: ((r.sparklend || 0) / total) * 100,
        sll: ((r.sll || 0) / total) * 100,
        total: 100,
      }
    })
  }, [raw, mode])

  const savingsPct = current.total > 0 ? ((current.savings / current.total) * 100).toFixed(1) : "0"
  const sparkPct = current.total > 0 ? ((current.sparklend / current.total) * 100).toFixed(1) : "0"
  const sllPct = current.total > 0 ? ((current.sll / current.total) * 100).toFixed(1) : "0"

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
        {(["W", "M", "Q"] as Period[]).map((p) => (
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
      title="Spark Ecosystem TVL"
      subtitle="Savings + SparkLend + Spark Liquidity Layer, all chains"
      units={mode === "usd" ? "USD" : "% of ecosystem"}
      source="DefiLlama /protocol/{spark-savings, sparklend, spark-liquidity-layer}"
      methodology={METHODOLOGY}
      actions={actions}
      height={340}
      footnote={
        <span>
          Q2 2026 report cited $12.6B combined ecosystem ($6.4B Savings + $3.6B SparkLend + $2.6B SLL). Live totals here reflect DefiLlama&apos;s Spark-attributed Savings segment
          only (see methodology). Current mix: Savings {savingsPct}% · SparkLend {sparkPct}% · SLL {sllPct}%.
        </span>
      }
    >
      <div style={{ height: 300 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              {STREAMS.map((s) => (
                <linearGradient key={s.key} id={`eco-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.05} />
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
              content={<ChartTooltip mode={mode} />}
              cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            {STREAMS.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stackId="1"
                stroke={s.color}
                strokeWidth={1}
                fill={`url(#eco-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
