"use client"

import { useMemo } from "react"
import { ByChainAreaChart } from "@/components/by-chain-area-chart"
import { ChartFrame } from "@/components/chart-frame"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatUSD } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { useThemeColors } from "@/components/theme-provider"

interface EcosystemData {
  daily: Array<{ date: number; savings: number; sparklend: number; sll: number; total: number }>
  current: { savings: number; sparklend: number; sll: number; total: number }
  savingsByChain: { chains: string[]; daily: Array<Record<string, number>> }
  sllByChain: { chains: string[]; daily: Array<Record<string, number>> }
}

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-32 bg-card-bg rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card-bg border border-card-border rounded-lg" />
        ))}
      </div>
      <div className="h-[340px] bg-card-bg border border-card-border rounded-lg" />
      <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
    </div>
  )
}

export default function SavingsPage() {
  const colors = useThemeColors()
  const { data, loading, error } = useCachedFetch<EcosystemData>("/api/ecosystem", { ttl: 15 * 60_000 })

  const savingsSeries = useMemo(() => data?.daily.map((d) => ({ date: d.date, savings: d.savings })) || [], [data])

  // 30d change
  const change30d = useMemo(() => {
    if (!data?.daily) return null
    const now = data.daily.at(-1)?.savings || 0
    const then = data.daily.at(-31)?.savings || 0
    if (then === 0) return null
    const delta = now - then
    const pct = (delta / then) * 100
    return { delta, pct }
  }, [data])

  if (loading || !data || !data.savingsByChain) return <LoadingSkeleton />
  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6 text-center">
        <p className="text-danger text-sm">{error}</p>
      </div>
    )
  }

  const currentSavings = data.current.savings
  const currentTotal = data.current.total

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Savings</h2>
        <div className="flex-1 h-px bg-card-border" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ backgroundColor: "#22c55e" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2" style={{ color: "#22c55e" }}>
            Savings TVL
          </span>
          <div className="flex items-baseline gap-2 pl-2">
            <span className="text-lg font-semibold text-text-primary tabular-nums">{formatUSD(currentSavings)}</span>
          </div>
          <span className="text-[9px] text-text-muted mt-0.5 block pl-2">Spark-attributed sUSDS</span>
        </div>
        <div className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ backgroundColor: "var(--accent)" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2" style={{ color: "var(--accent)" }}>
            30d change
          </span>
          <div className="flex items-baseline gap-2 pl-2">
            <span className="text-lg font-semibold text-text-primary tabular-nums">
              {change30d ? (change30d.pct >= 0 ? "+" : "") + change30d.pct.toFixed(1) + "%" : "—"}
            </span>
            {change30d && (
              <span
                className={`text-[11px] font-medium ${change30d.delta > 0 ? "text-positive" : "text-danger"}`}
              >
                {change30d.delta > 0 ? "▲" : "▼"}
                {formatUSD(Math.abs(change30d.delta))}
              </span>
            )}
          </div>
          <span className="text-[9px] text-text-muted mt-0.5 block pl-2">vs 30 days ago</span>
        </div>
        <div className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ backgroundColor: "#5B7FFF" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2" style={{ color: "#5B7FFF" }}>
            Chains covered
          </span>
          <div className="flex items-baseline gap-2 pl-2">
            <span className="text-lg font-semibold text-text-primary tabular-nums">
              {data.savingsByChain.chains.filter((c) => (data.savingsByChain.daily.at(-1)?.[c] || 0) > 0).length}
            </span>
          </div>
          <span className="text-[9px] text-text-muted mt-0.5 block pl-2">of {data.savingsByChain.chains.length} deployed</span>
        </div>
        <div className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ backgroundColor: "#a855f7" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2" style={{ color: "#a855f7" }}>
            Share of Spark
          </span>
          <div className="flex items-baseline gap-2 pl-2">
            <span className="text-lg font-semibold text-text-primary tabular-nums">
              {currentTotal > 0 ? ((currentSavings / currentTotal) * 100).toFixed(1) : "0"}%
            </span>
          </div>
          <span className="text-[9px] text-text-muted mt-0.5 block pl-2">of ecosystem TVL</span>
        </div>
      </div>

      {/* Hero: Savings TVL over time */}
      <ChartFrame
        title="Spark Savings TVL"
        subtitle="Total sUSDS deposits attributed to Spark, all chains"
        units="USD"
        source="DefiLlama /protocol/spark-savings"
        methodology={
          <>
            Total TVL of sUSDS deposits routed through Spark's UI. Sky mints sUSDS to any depositor (whether they use Sky's UI or Spark's), so DefiLlama's "Spark Savings" figure attributes only the Spark-routed slice. The Q2 2026 report cited $6.4B for total Savings — that figure includes deposits made via Sky's own UI too.
          </>
        }
        height={340}
        footnote={
          <span>
            Q2 2026 report cited $6.4B total Savings TVL. Live Spark-attributed portion: <strong>{formatUSD(currentSavings)}</strong>. The gap is deposits routed through Sky's UI rather than Spark's.
          </span>
        }
      >
        <div style={{ height: 300 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={savingsSeries.map((s) => ({
              label: new Date(s.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }),
              savings: s.savings,
            }))} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="savingsHero" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: colors.textMuted }}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: colors.textMuted }}
                tickFormatter={(v) => formatUSD(v)}
                width={60}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="custom-tooltip min-w-[160px]">
                      <p className="text-xs text-text-muted mb-1">{label}</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Savings TVL</span>
                        <span className="font-semibold text-text-primary">{formatUSD(payload[0].value)}</span>
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area type="monotone" dataKey="savings" stroke="#22c55e" strokeWidth={1.5} fill="url(#savingsHero)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      {/* TVL by chain */}
      <ByChainAreaChart
        title="Savings TVL by Chain"
        subtitle="Breakdown of Spark-attributed sUSDS by deployment chain"
        chains={data.savingsByChain.chains}
        daily={data.savingsByChain.daily}
        source="DefiLlama /protocol/spark-savings per-chain series"
        methodology={
          <>
            Ethereum has been Spark Savings&apos; anchor market since launch; Arbitrum is the largest non-Ethereum
            chain (usually ~$150-200M). The chain roster expanded through 2026 as Sky routed sUSDS to more
            L2s. Toggle to % to see how the mix has shifted.
          </>
        }
        footnote={
          <span>
            Ethereum dominates but Arbitrum is meaningful (~$187M current). Watching Arbitrum growth is a
            proxy for Sky&apos;s L2 expansion strategy.
          </span>
        }
        height={320}
      />
    </div>
  )
}
