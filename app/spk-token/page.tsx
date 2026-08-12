"use client"

import { useMemo } from "react"
import { ChartFrame } from "@/components/chart-frame"
import { SpkHolderDistribution } from "@/components/spk-holder-distribution"
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatUSD } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { useThemeColors } from "@/components/theme-provider"

interface SpkData {
  daily: Array<{ date: number; price: number; mcap: number }>
  current: { price: number; mcap: number; supply: number }
  meta: { source: string; contract: string; drawdownPct: number; firstDate: string; note: string }
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
    </div>
  )
}

function formatPrice(v: number): string {
  if (v < 0.01) return `$${v.toFixed(5)}`
  if (v < 1) return `$${v.toFixed(4)}`
  return `$${v.toFixed(2)}`
}

function formatSupply(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return v.toFixed(0)
}

export default function SpkTokenPage() {
  const colors = useThemeColors()
  const { data, loading, error } = useCachedFetch<SpkData>("/api/spk-token", { ttl: 10 * 60_000 })
  const { data: holdersData } = useCachedFetch<any>("/api/spk-holders", { ttl: 30 * 60_000 })

  const chartData = useMemo(
    () =>
      data?.daily.map((d) => ({
        label: new Date(d.date * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "2-digit",
          timeZone: "UTC",
        }),
        price: d.price,
        mcap: d.mcap,
      })) || [],
    [data]
  )

  // ATH stats for the honest-decline callout
  const stats = useMemo(() => {
    if (!data?.daily || data.daily.length === 0) return null
    const prices = data.daily.map((d) => d.price)
    const maxPrice = Math.max(...prices)
    const maxIdx = prices.indexOf(maxPrice)
    const currentPrice = data.current.price
    const drawdown = maxPrice > 0 ? ((currentPrice - maxPrice) / maxPrice) * 100 : 0
    return { maxPrice, maxDate: new Date(data.daily[maxIdx].date * 1000), drawdown }
  }, [data])

  if (loading || !data) return <LoadingSkeleton />
  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6 text-center">
        <p className="text-danger text-sm">{error}</p>
      </div>
    )
  }

  const { current, meta } = data

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">$SPK Token</h2>
        <div className="flex-1 h-px bg-card-border" />
        <a
          href={`https://etherscan.io/token/${meta.contract}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] uppercase tracking-[0.08em] hover:text-accent transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          {meta.contract.slice(0, 8)}…{meta.contract.slice(-6)} ↗
        </a>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "SPK Price", value: formatPrice(current.price), sub: "Live from DefiLlama Coins", color: "#FF6B35" },
          {
            label: "Market Cap",
            value: current.mcap ? formatUSD(current.mcap) : "—",
            sub: current.supply > 0 ? `${formatSupply(current.supply)} circulating` : "",
            color: "#5B7FFF",
          },
          {
            label: "Drawdown since launch",
            value: meta.drawdownPct.toFixed(1) + "%",
            sub: `from ${meta.firstDate}`,
            color: meta.drawdownPct < 0 ? "#F26B68" : "#22c55e",
          },
          {
            label: "Drawdown from ATH",
            value: stats ? stats.drawdown.toFixed(1) + "%" : "—",
            sub: stats ? `ATH ${formatPrice(stats.maxPrice)} on ${stats.maxDate.toISOString().slice(0, 10)}` : "",
            color: stats && stats.drawdown < 0 ? "#F26B68" : "#22c55e",
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

      {/* Hero: Price */}
      <ChartFrame
        title="SPK Price"
        subtitle="Daily close, USD"
        units="USD"
        source={meta.source}
        methodology={
          <>
            SPK price series from DefiLlama Coins API (mirror of CoinGecko&apos;s spark-2 aggregate).
            SPK is the governance token of the Spark protocol; unlike SparkLend deposits or SLL yield,
            SPK is a directional asset — this chart shows how the market has priced Spark&apos;s equity story.
          </>
        }
        height={340}
        footnote={
          <span>
            Q2 2026 report noted <strong>$1.31M in SPK buybacks from operating surplus</strong> during the
            quarter. Live price: <strong>{formatPrice(current.price)}</strong> ({meta.drawdownPct.toFixed(1)}%
            from launch price on {meta.firstDate}). Buybacks have not offset market drawdown.
          </span>
        }
      >
        <div style={{ height: 300 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="spkPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.02} />
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
                tickFormatter={(v) => formatPrice(v)}
                width={65}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="custom-tooltip min-w-[160px]">
                      <p className="text-xs text-text-muted mb-1">{label}</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">SPK</span>
                        <span className="font-semibold text-text-primary">{formatPrice(payload[0].value)}</span>
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area type="monotone" dataKey="price" stroke="#FF6B35" strokeWidth={1.5} fill="url(#spkPrice)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      {/* Market cap chart */}
      <ChartFrame
        title="SPK Market Cap"
        subtitle="Implied market cap = daily price × current circulating supply"
        units="USD"
        source={meta.source}
        methodology={
          <>
            {meta.note} SPK&apos;s supply schedule is largely front-loaded (team + investors + community allocation are
            defined), so multiplying historical price by current supply overstates early-period mcap slightly and
            understates late-period mcap slightly. Directional shape is accurate.
          </>
        }
        height={280}
      >
        <div style={{ height: 240 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
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
                        <span className="text-text-secondary">Market Cap</span>
                        <span className="font-semibold text-text-primary">{formatUSD(payload[0].value)}</span>
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Line type="monotone" dataKey="mcap" stroke="#5B7FFF" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      {/* Top holders */}
      {holdersData?.holders && (
        <SpkHolderDistribution data={holdersData} currentSpkPrice={current.price} />
      )}
    </div>
  )
}
