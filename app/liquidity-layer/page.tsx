"use client"

import { useMemo, useState } from "react"
import { ByChainAreaChart } from "@/components/by-chain-area-chart"
import { ChartFrame } from "@/components/chart-frame"
import { SllVenueBreakdown } from "@/components/sll-venue-breakdown"
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

interface EcosystemData {
  daily: Array<{ date: number; savings: number; sparklend: number; sll: number; total: number }>
  current: { savings: number; sparklend: number; sll: number; total: number }
  sllByChain: { chains: string[]; daily: Array<Record<string, number>> }
}

interface FinancialsData {
  monthly: Array<{ month: string; sllGross: number; sllNet: number; sllCost: number }>
  latest?: { month: string; sllNet: number }
}

interface VenueData {
  asOf: string
  totalUsd: number
  history: { chains: string[]; daily: Array<Record<string, number>> }
  change30d: { delta: number; pct: number } | null
  categories: any[]
  positions: any[]
  ownShare: number
  externalShare: number
  sparkLendShare: number
  meta: { source: string; note: string }
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
  const { data: venues } = useCachedFetch<VenueData>("/api/sll-venues", { ttl: 30 * 60_000 })

  const sllSeries = useMemo(
    () => venues?.history?.daily.map((d) => ({ date: d.date, sll: d.total })) || [],
    [venues]
  )

  // Monthly, from Spark's own books. The DefiLlama daily series this chart used
  // to read captures roughly two thirds of Spark's gross yield from May 2026 on
  // and prints losses in months Spark reports a profit.
  const revenueData = useMemo(() => {
    if (!fin?.monthly) return []
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return fin.monthly.map((m) => {
      const [y, mm] = m.month.split("-")
      return { label: `${names[Number(mm) - 1]} '${y.slice(2)}`, sllRevenue: m.sllNet }
    })
  }, [fin])

  const change30d = venues?.change30d ?? null

  const vsQ2 = useMemo(() => {
    if (!venues?.totalUsd) return null
    const delta = venues.totalUsd - Q2_SLL_ANCHOR
    return { delta, pct: (delta / Q2_SLL_ANCHOR) * 100 }
  }, [venues])

  const latestMonth = useMemo(() => fin?.monthly?.at(-1) ?? null, [fin])

  if (ecoLoading || !eco || !venues?.history) return <LoadingSkeleton />

  const currentSll = venues.totalUsd

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
            label: "Latest month net",
            value: latestMonth ? formatUSD(latestMonth.sllNet) : "—",
            sub: latestMonth
              ? latestMonth.sllNet < 0
                ? "Funding cost exceeded yield"
                : `on ${formatUSD(latestMonth.sllGross)} of gross yield`
              : "",
            color: latestMonth && latestMonth.sllNet < 0 ? "#F26B68" : "#22c55e",
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
        subtitle="Total Liquidity Layer assets, all chains"
        units="USD"
        source="data.spark.finance (Block Analitica)"
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
            {vsQ2 && vsQ2.delta < 0 && " SLL has been shrinking as Sky redirects capital and stables demand across DeFi has softened."}{" "}
            Every figure on this page is Spark&apos;s own <strong>allocated assets</strong>,
            from the same allocation table as the venue breakdown below. Spark also publishes a
            larger <em>total assets</em> number, and DefiLlama publishes a smaller TVL; the three
            count different things, so do not compare them across sites.
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
              <Area type="monotone" dataKey="sll" stroke="#FF6B35" strokeWidth={1.5} fill="url(#sllHero)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      {/* SLL Deployment by Venue — the "where is the balance sheet parked" chart */}
      {venues?.categories && <SllVenueBreakdown data={venues} />}

      {/* Side-by-side: TVL by chain + Revenue over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ByChainAreaChart
          title="SLL TVL by Chain"
          subtitle="Chain distribution of allocated assets, averaged over each period"
          chains={venues.history.chains}
          daily={venues.history.daily}
          source="data.spark.finance (Block Analitica)"
          methodology={
            <>
              SLL has been deployed on Ethereum + 7 L2s over 2026 as Sky expanded routes. Ethereum still holds
              99%+ of the balance — most L2 destinations show a token allocation but the bulk of the balance
              sheet sits on Ethereum where the yield venues (Morpho, Aave, Ethena) are most liquid.
            </>
          }
          footnote={
            <span>
              Values are <strong>averages across each period</strong>, not month-end levels, so
              the latest bucket reads below the headline card while a month is still running.
              Ethereum holds the large majority of the Liquidity Layer, with Base the only other
              meaningful chain. Watching the non-Ethereum share tick up would be a signal Sky is
              diversifying deployment.
            </span>
          }
          height={280}
        />

        <ChartFrame
          title="SLL Revenue"
          subtitle="Monthly net yield from Liquidity Layer deployments, after Sky funding cost"
          units="USD"
          source="data.spark.finance (Block Analitica)"
          methodology={
            <>
              Spark&apos;s own monthly accounting: gross yield on deployed capital less what Sky
              charges to fund it. Negative months are real and mean the funding cost exceeded
              what the book earned. Net is a small residual between two much larger numbers, so
              it swings hard on modest changes to either. Not sourced from DefiLlama, whose
              series for this product captures roughly two thirds of Spark&apos;s reported gross
              yield from May 2026 onward.
            </>
          }
          height={280}
          footnote={
            latestMonth ? (
              <span>
                Latest month: <strong>{formatUSD(latestMonth.sllNet)}</strong> net on{" "}
                <strong>{formatUSD(latestMonth.sllGross)}</strong> of gross yield, a{" "}
                <strong>{((latestMonth.sllNet / latestMonth.sllGross) * 100).toFixed(1)}%</strong>{" "}
                take rate. The current month is still accruing.
              </span>
            ) : undefined
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
                <Bar dataKey="sllRevenue" radius={[2, 2, 0, 0]} isAnimationActive={false}>
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
