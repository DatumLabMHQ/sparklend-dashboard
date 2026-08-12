"use client"

import { useMemo, useState } from "react"
import { ByChainAreaChart } from "@/components/by-chain-area-chart"
import { ChartFrame } from "@/components/chart-frame"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { formatUSD } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { useThemeColors } from "@/components/theme-provider"
import { aggregateData } from "@/components/financials/aggregate"
import { PeriodToggle, type Period } from "@/components/financials/period-toggle"

interface EcosystemData {
  daily: Array<{ date: number; savings: number; sparklend: number; sll: number; total: number }>
  current: { savings: number; sparklend: number; sll: number; total: number }
  sllByChain: { chains: string[]; daily: Array<Record<string, number>> }
}

interface FinancialsData {
  daily: Array<{ date: number; sllRevenue: number }>
}

const Q2_SLL_ANCHOR = 2_600_000_000 // $2.6B — Q2 report close

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-40 bg-card-bg rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card-bg border border-card-border rounded-lg" />
        ))}
      </div>
      <div className="h-[340px] bg-card-bg border border-card-border rounded-lg" />
    </div>
  )
}

export default function LiquidityLayerPage() {
  const colors = useThemeColors()
  const { data: eco, loading: ecoLoading } = useCachedFetch<EcosystemData>("/api/ecosystem", { ttl: 15 * 60_000 })
  const { data: fin } = useCachedFetch<FinancialsData>("/api/financials", { ttl: 10 * 60_000 })
  const [period, setPeriod] = useState<Period>("W")

  const sllSeries = useMemo(
    () => eco?.daily.map((d) => ({ date: d.date, sll: d.sll })) || [],
    [eco]
  )

  const revenueData = useMemo(() => {
    if (!fin?.daily) return []
    // Only include days SLL has data (post-Apr 2025)
    const withSll = fin.daily.filter((d) => d.sllRevenue !== undefined && d.sllRevenue !== 0)
    return aggregateData(withSll as any, period, ["sllRevenue"])
  }, [fin, period])

  const change30d = useMemo(() => {
    if (!eco?.daily) return null
    const now = eco.daily.at(-1)?.sll || 0
    const then = eco.daily.at(-31)?.sll || 0
    if (then === 0) return null
    return { delta: now - then, pct: ((now - then) / then) * 100 }
  }, [eco])

  const vsQ2 = useMemo(() => {
    if (!eco) return null
    const delta = eco.current.sll - Q2_SLL_ANCHOR
    const pct = (delta / Q2_SLL_ANCHOR) * 100
    return { delta, pct }
  }, [eco])

  const revenue30d = useMemo(() => {
    if (!fin?.daily) return 0
    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - 30 * 86400
    return fin.daily.filter((d) => d.date >= cutoff).reduce((s, d) => s + (d.sllRevenue || 0), 0)
  }, [fin])

  if (ecoLoading || !eco || !eco.sllByChain) return <LoadingSkeleton />

  const currentSll = eco.current.sll

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Spark Liquidity Layer</h2>
        <div className="flex-1 h-px bg-card-border" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "SLL TVL", value: formatUSD(currentSll), sub: "ALM Proxy deployments", color: "#FF6B35" },
          {
            label: "vs Q2 report",
            value: vsQ2 ? (vsQ2.pct >= 0 ? "+" : "") + vsQ2.pct.toFixed(1) + "%" : "—",
            sub: vsQ2 ? `${formatUSD(Math.abs(vsQ2.delta))} ${vsQ2.delta >= 0 ? "above" : "below"} $2.6B anchor` : "",
            color: vsQ2 && vsQ2.delta < 0 ? "#F26B68" : "#22c55e",
          },
          {
            label: "30d change",
            value: change30d ? (change30d.pct >= 0 ? "+" : "") + change30d.pct.toFixed(1) + "%" : "—",
            sub: change30d ? `${change30d.delta > 0 ? "▲" : "▼"}${formatUSD(Math.abs(change30d.delta))}` : "",
            color: "#5B7FFF",
          },
          {
            label: "30d Revenue",
            value: formatUSD(revenue30d),
            sub: revenue30d < 0 ? "Funding cost > yield" : "Net of Sky funding cost",
            color: revenue30d < 0 ? "#F26B68" : "#22c55e",
          },
        ].map((card) => (
          <div key={card.label} className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ backgroundColor: card.color }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2" style={{ color: card.color }}>
              {card.label}
            </span>
            <span className="text-lg font-semibold text-text-primary tabular-nums block pl-2">{card.value}</span>
            {card.sub && <span className="text-[9px] text-text-muted mt-0.5 block pl-2">{card.sub}</span>}
          </div>
        ))}
      </div>

      {/* Hero: SLL TVL over time with Q2 anchor */}
      <ChartFrame
        title="Spark Liquidity Layer TVL"
        subtitle="ALM Proxy deployments across Morpho, Aave, Ethena, Curve, PSM and other venues, all chains"
        units="USD"
        source="DefiLlama /protocol/spark-liquidity-layer"
        methodology={
          <>
            SLL deploys idle USDS/DAI from Sky&apos;s balance sheet into external yield venues (Morpho vaults, Aave V3, Ethena sUSDe, PSM, Curve pools).
            Chart shows total ALM Proxy TVL across all destinations. The Q2 2026 report cited $2.6B; live shows how that&apos;s tracked since Q2 close.
          </>
        }
        height={340}
        footnote={
          <span>
            Q2 anchor <strong>$2.6B</strong>. Live <strong>{formatUSD(currentSll)}</strong>
            {vsQ2 && (
              <> — {vsQ2.delta >= 0 ? "up" : "down"} <strong>{Math.abs(vsQ2.pct).toFixed(1)}%</strong> from Q2 close.</>
            )}
            {vsQ2 && vsQ2.delta < 0 && " SLL has been shrinking as Sky redirects capital and stables demand across DeFi has softened."}
          </span>
        }
      >
        <div style={{ height: 300 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sllSeries.map((s) => ({
              label: new Date(s.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }),
              sll: s.sll,
            }))} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="sllHero" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.05} />
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
              <ReferenceLine
                y={Q2_SLL_ANCHOR}
                stroke={colors.warning}
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: "Q2 close: $2.6B", position: "insideTopRight", fill: colors.warning, fontSize: 9 }}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="custom-tooltip min-w-[160px]">
                      <p className="text-xs text-text-muted mb-1">{label}</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">SLL TVL</span>
                        <span className="font-semibold text-text-primary">{formatUSD(payload[0].value)}</span>
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area type="monotone" dataKey="sll" stroke="#FF6B35" strokeWidth={1.5} fill="url(#sllHero)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      {/* Side-by-side: TVL by chain + Revenue over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ByChainAreaChart
          title="SLL TVL by Chain"
          subtitle="Chain distribution of ALM Proxy deployments"
          chains={eco.sllByChain.chains}
          daily={eco.sllByChain.daily}
          source="DefiLlama per-chain series"
          methodology={
            <>
              SLL has been deployed on Ethereum + 7 L2s over 2026 as Sky expanded routes. Ethereum still holds
              99%+ of the balance — most L2 destinations show a token allocation but the bulk of the balance
              sheet sits on Ethereum where the yield venues (Morpho, Aave, Ethena) are most liquid.
            </>
          }
          footnote={
            <span>
              Ethereum ~99% of SLL. Watching non-Ethereum share tick up would be a signal Sky is diversifying
              deployment across chains.
            </span>
          }
          height={280}
        />

        <ChartFrame
          title="SLL Revenue"
          subtitle="Net yield from ALM Proxy deployments, after Sky funding cost"
          units="USD"
          source="DefiLlama /summary/fees/spark-liquidity-layer dailyRevenue"
          actions={<PeriodToggle selected={period} onChange={setPeriod} />}
          methodology={
            <>
              DefiLlama&apos;s dailyRevenue line for spark-liquidity-layer is net of what Sky charges for funding
              (SSR × outstanding USDS). Days when funding cost exceeds venue yield print negative. That&apos;s an
              honest signal — SLL is not always a positive contributor to Spark&apos;s revenue stack.
            </>
          }
          height={280}
          footnote={
            <span>
              Trailing 30-day: <strong>{formatUSD(revenue30d)}</strong>
              {revenue30d < 0 && " — negative days outweighed positive ones. Fund yields are compressing while Sky's funding rate stays fixed."}
            </span>
          }
        >
          <div style={{ height: 240 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
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
                  tickFormatter={(v) => formatUSD(v)}
                  width={55}
                />
                <ReferenceLine y={0} stroke={colors.textMuted} strokeWidth={0.5} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="custom-tooltip min-w-[160px]">
                        <p className="text-xs text-text-muted mb-1">{label}</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">SLL Revenue</span>
                          <span className="font-semibold text-text-primary">{formatUSD(payload[0].value)}</span>
                        </div>
                      </div>
                    )
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="sllRevenue" radius={[2, 2, 0, 0]}>
                  {revenueData.map((d: any, i: number) => (
                    <Cell key={i} fill={d.sllRevenue >= 0 ? "#22c55e" : "#F26B68"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </div>
    </div>
  )
}
