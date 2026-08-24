"use client"

import { useMemo, useState } from "react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD } from "@/lib/utils"

interface BuybackData {
  treasury: {
    totalUSD: number
    spkHeldUSD: number
    spkHeldAmount: number
    lines: Array<{ symbol: string; amount: number; priceUSD: number; valueUSD: number; isSpendable: boolean }>
    asOf: number
  }
  historicalUSD: Array<{ date: number; totalUSD: number }>
  threshold: {
    targetUSD: number
    cushionUSD: number
    cushionMonths: number | null
    standardBuybackRate: number
    monthlyBudgetUSD: number
    effectiveFrom: string
    note?: string
    sourceUrl: string
  }
  buybacks: {
    fills: Array<{
      timestamp: number
      txHash: string
      usdsSpent: number
      spkBought: number
      effectivePriceUSD: number
      kind: "spk_in" | "usds_out"
    }>
    cumulativeUsdsSpent: number
    cumulativeSpkBought: number
    avgPriceUSD: number | null
  }
}

const METHODOLOGY_TREASURY = `Spendable treasury held by the Spark SubDAO Proxy (0x3300...) — USDS + USDC + PYUSD only. SPK holdings from prior buybacks are shown separately (they are buyback output, not spendable capital) so the figure lines up with Phoenix Labs' "Total Treasury" number in the monthly forum posts and with Sam MacPherson's Aug 2026 chart.

Historical series is DefiLlama's tokensInUsd snapshot for the same address — same source Sam's chart uses. Buyback threshold is the off-chain policy target computed monthly by Phoenix Labs and posted to the Sky forum (Standard Buyback = (Treasury − Target) × 25%). Cushion = Treasury − Target. Runway = Cushion ÷ this month's TWAP budget.`

const METHODOLOGY_BUYBACKS = `Buybacks execute through CoW Protocol. The verified flow is:

    CoW settlement (0x9008...ab41)  ->  buyback contract (0x797B...2BF3)  ->  Ops Multisig (0x2E1b...edfc)

The purchase is the first leg. A chunked eth_getLogs scan of SPK Transfer(*, buyback contract) across the trailing ~430 days returns 2,390 fills totalling 120.78M SPK, every one of them from the settlement contract. Verified 25 Aug 2026.

The USD leg is DefiLlama's holdersRevenue series for Spark, which reads SPK received at that same buyback address, so both figures describe one flow and their ratio is a true program-wide VWAP.

Correction, 25 Aug 2026: an earlier version of this panel counted SPK moving from the Ops Multisig to the SubDAO Proxy (120.78M became 94.26M) and reported USDS sent to the multisig as spend. Both were the wrong leg. The multisig transfer is an onward move after the purchase, and USDS sent there is funding for future rounds rather than money spent on SPK.

The two legs are NOT paired 1:1 per transaction: CoW TWAP orders settle asynchronously across days, so a single USDS round can fund multiple SPK-in transfers and vice versa. The dashboard reports each leg as its own total and shows the flow in the table below labelled by direction. Average price = cumulative USDS ÷ cumulative SPK across the entire program.

Cross-check: Spark stated on 2026-08-18 that it had "bought back over 100M SPK" with "more than $2.1M of protocol revenue" behind it. Our on-chain scan reads 120.78M SPK, and DefiLlama's independently-built series puts the spend at about $2.44M. All three agree.`

function formatCurrency(v: number, digits = 1): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(digits)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(digits)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(digits)}K`
  return `$${v.toFixed(2)}`
}

function formatSpk(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M SPK`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K SPK`
  return `${v.toFixed(0)} SPK`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  })
}

export function BuybackSection({ currentSpkPrice }: { currentSpkPrice: number }) {
  const colors = useThemeColors()
  const { data, loading } = useCachedFetch<BuybackData>("/api/buybacks", {
    ttl: 15 * 60_000,
  })

  const treasuryChart = useMemo(() => {
    if (!data?.historicalUSD?.length) return []
    return data.historicalUSD.map((p) => ({
      label: formatDate(p.date),
      totalUSD: p.totalUSD,
    }))
  }, [data])

  // Weekly buyback spend for the pace chart. The series is already one row
  // per day of purchases, so every row counts.
  const paceChart = useMemo(() => {
    if (!data?.buybacks.fills?.length) return []
    const fills = [...data.buybacks.fills].sort((a, b) => a.timestamp - b.timestamp)
    const weekly = new Map<string, { usdsSpent: number; spkBought: number }>()
    for (const f of fills) {
      const d = new Date(f.timestamp * 1000)
      const day = d.getUTCDay()
      const mondayOffset = (day + 6) % 7
      const monday = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset)
      )
      const key = monday.toISOString().slice(0, 10)
      const cur = weekly.get(key) || { usdsSpent: 0, spkBought: 0 }
      cur.usdsSpent += f.usdsSpent
      cur.spkBought += f.spkBought
      weekly.set(key, cur)
    }
    return Array.from(weekly.entries())
      .map(([iso, v]) => {
        const [y, m, dd] = iso.split("-").map(Number)
        return {
          label:
            new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }) + ` '${String(y).slice(2)}`,
          usdsSpent: v.usdsSpent,
        }
      })
      .sort((a, b) => (a.label < b.label ? -1 : 1))
  }, [data])

  if (loading || !data) {
    return (
      <div className="tui-panel h-[300px] flex items-center justify-center animate-pulse">
        <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted">
          Loading Buyback / Treasury…
        </div>
      </div>
    )
  }

  const { treasury, threshold, buybacks } = data
  const discountVsSpot =
    buybacks.avgPriceUSD && currentSpkPrice > 0
      ? ((currentSpkPrice - buybacks.avgPriceUSD) / buybacks.avgPriceUSD) * 100
      : null

  return (
    <>
      {/* Section divider */}
      <div className="tui-divider-labeled">
        <span className="tui-divider-label">Buyback &amp; Treasury</span>
      </div>

      {/* Cushion metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Spendable Treasury",
            value: formatCurrency(treasury.totalUSD, 2),
            sub: `+ ${formatSpk(treasury.spkHeldAmount)} held (${formatCurrency(treasury.spkHeldUSD, 1)})`,
            color: "#22c55e",
          },
          {
            label: "Buyback Threshold",
            value: formatCurrency(threshold.targetUSD, 2),
            sub: `Effective ${threshold.effectiveFrom}`,
            color: "#F26B68",
          },
          {
            label: "Cushion Above Threshold",
            value: formatCurrency(threshold.cushionUSD, 2),
            sub:
              threshold.cushionMonths != null
                ? `${threshold.cushionMonths.toFixed(1)} months at current pace`
                : "Runway unavailable",
            color: threshold.cushionUSD > 0 ? "#22c55e" : "#F26B68",
          },
          {
            label: "Monthly TWAP Budget",
            value: formatCurrency(threshold.monthlyBudgetUSD, 2),
            sub: `Standard rate ${(threshold.standardBuybackRate * 100).toFixed(0)}%`,
            color: "#FF6B35",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden"
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[2px]"
              style={{ backgroundColor: card.color }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2"
              style={{ color: card.color }}
            >
              {card.label}
            </span>
            <span className="text-lg font-semibold text-text-primary tabular-nums block pl-2">
              {card.value}
            </span>
            {card.sub && (
              <span className="text-[9px] text-text-muted mt-0.5 block pl-2">
                {card.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Treasury balance over time with threshold line */}
      <ChartFrame
        title="Spark Treasury Balance"
        subtitle="SubDAO Proxy value (USDS + USDC + PYUSD + SPK), daily"
        units="USD"
        source="DefiLlama tokensInUsd + on-chain balanceOf"
        methodology={METHODOLOGY_TREASURY}
        height={340}
        footnote={
          <span>
            Current: <strong>{formatCurrency(treasury.totalUSD, 2)}</strong>{" "}
            ({threshold.cushionUSD > 0 ? "+" : ""}
            {formatCurrency(threshold.cushionUSD, 2)} vs threshold). Threshold set
            monthly by Phoenix Labs; formula = max(capital reserve, opex reserve).
            {threshold.note ? ` Latest cycle: ${threshold.note}` : null}
          </span>
        }
      >
        <div style={{ height: 300 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={treasuryChart}
              margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
            >
              <defs>
                <linearGradient id="treasuryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.08} />
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
                tickFormatter={(v) => formatCurrency(v, 0)}
                width={60}
              />
              <ReferenceLine
                y={threshold.targetUSD}
                stroke={colors.warning}
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: `Buyback threshold ${formatCurrency(threshold.targetUSD, 1)}`,
                  position: "insideBottomRight",
                  fill: colors.warning,
                  fontSize: 9,
                }}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="custom-tooltip min-w-[180px]">
                      <p className="text-xs text-text-muted mb-1">{label}</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Treasury</span>
                        <span className="font-semibold text-text-primary">
                          {formatCurrency(payload[0].value, 2)}
                        </span>
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="totalUSD"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#treasuryFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      {/* Buyback pace + economics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartFrame
          title="Weekly Buyback Spend"
          subtitle="USDS deployed to CoW Swap TWAP orders, by week"
          units="USDS"
          source="Ethereum Transfer logs (SubDAO Proxy ↔ Operations Multisig)"
          methodology={METHODOLOGY_BUYBACKS}
          height={300}
          footnote={
            <span>
              Cumulative:{" "}
              <strong>{formatCurrency(buybacks.cumulativeUsdsSpent, 2)}</strong> spent,{" "}
              <strong>{formatSpk(buybacks.cumulativeSpkBought)}</strong> acquired
              across {buybacks.fills.length} cycles.
            </span>
          }
        >
          <div style={{ height: 260 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paceChart}
                margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
              >
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
                  tickFormatter={(v) => formatCurrency(v, 0)}
                  width={55}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="custom-tooltip min-w-[160px]">
                        <p className="text-xs text-text-muted mb-1">
                          Week of {label}
                        </p>
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">USDS spent</span>
                          <span className="font-semibold text-text-primary">
                            {formatCurrency(payload[0].value, 2)}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="usdsSpent" fill="#FF6B35" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          title="Buyback Economics"
          subtitle="What Spark is paying per SPK vs current spot"
          units="USD per SPK"
          source="On-chain fills"
          methodology={METHODOLOGY_BUYBACKS}
          height={300}
        >
          <div className="space-y-3 p-3">
            {[
              {
                label: "Cumulative USDS Spent",
                value: formatCurrency(buybacks.cumulativeUsdsSpent, 2),
              },
              {
                label: "Cumulative SPK Acquired",
                value: formatSpk(buybacks.cumulativeSpkBought),
              },
              {
                label: "Average Buyback Price",
                value:
                  buybacks.avgPriceUSD != null
                    ? `$${buybacks.avgPriceUSD.toFixed(5)}`
                    : "—",
              },
              {
                label: "Current SPK Spot",
                value: `$${currentSpkPrice.toFixed(5)}`,
              },
              {
                label: "Spot vs Avg Buy",
                value:
                  discountVsSpot != null
                    ? `${discountVsSpot >= 0 ? "+" : ""}${discountVsSpot.toFixed(1)}%`
                    : "—",
                highlight: true,
                color:
                  discountVsSpot != null && discountVsSpot < 0
                    ? "#22c55e"
                    : "#F26B68",
              },
              {
                label: "Days With Buyback Activity",
                value: buybacks.fills.length.toString(),
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between items-baseline pb-2 border-b border-card-border/50"
              >
                <span className="text-[11px] text-text-secondary uppercase tracking-[0.05em]">
                  {row.label}
                </span>
                <span
                  className={`tabular-nums ${row.highlight ? "text-base font-bold" : "text-sm font-medium text-text-primary"}`}
                  style={row.highlight && row.color ? { color: row.color } : undefined}
                >
                  {row.value}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-text-muted leading-relaxed pt-2">
              {discountVsSpot != null && discountVsSpot < 0
                ? "Spot trades below average buyback price — future buybacks accrete more SPK per dollar."
                : discountVsSpot != null
                  ? "Spot trades above average buyback price — early cycles bought cheaper than the market pays now."
                  : "Not enough fills yet to compute an average."}
            </p>
          </div>
        </ChartFrame>
      </div>

      {/* Recent buyback days */}
      <div className="tui-panel p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
            Recent Buyback Days
          </h3>
          <a
            href="https://etherscan.io/address/0x797B010E0BABb493b8DEDD6F6ce5cc72778C2BF3"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-text-muted hover:text-accent transition-colors"
          >
            buyback contract 0x797B…2BF3 ↗
          </a>
        </div>
        {buybacks.fills.length === 0 ? (
          <p className="text-[11px] text-text-muted py-4 text-center">
            No buyback activity recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.05em] text-text-muted border-b border-card-border">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-right py-2 px-2">Spent on SPK</th>
                  <th className="text-right py-2 px-2">Implied SPK at day&apos;s close</th>
                </tr>
              </thead>
              <tbody>
                {buybacks.fills.slice(0, 12).map((f) => (
                  <tr
                    key={f.timestamp}
                    className="border-b border-card-border/40 last:border-b-0"
                  >
                    <td className="py-2 px-2 text-text-secondary">
                      {formatDate(f.timestamp)}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums text-text-primary">
                      {formatCurrency(f.usdsSpent, 2)}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums text-text-secondary">
                      {currentSpkPrice > 0
                        ? formatSpk(f.usdsSpent / currentSpkPrice)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-text-muted mt-2">
              Daily spend is DefiLlama&apos;s holdersRevenue series for Spark, which values SPK
              received at the buyback contract. The right-hand column applies today&apos;s spot
              price and is therefore indicative, not the price actually paid on that day.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
