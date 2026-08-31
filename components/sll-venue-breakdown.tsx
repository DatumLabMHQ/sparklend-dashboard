"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { formatUSD } from "@/lib/utils"

const METHODOLOGY = `SLL's balance sheet broken down by venue category. Each token position in the ALM Proxy on Ethereum is mapped to the venue it represents:

• Spark Vault V2 — Spark's own vault products (spUSDS, spDAI, spUSDT, spPYUSD, spUSDC). Spark self-curates these.
• Morpho Blue — Spark-curated Morpho vaults (usually flagged with the SPARK prefix)
• Aave V3 — aTokens (Core and Prime instances)
• Yield tokens — Ethena sUSDe/USDe, Maple syrupUSDC, Superstate USTB (RWA)
• Direct stablecoins — idle USDS, USDC, USDT, DAI, PYUSD, sUSDS sitting in the ALM Proxy awaiting deployment

Source is Spark's own allocation table at data.spark.finance, not an aggregator's token balances. An earlier version of this panel read DefiLlama's per-token map, which sees only ERC-20 balances and therefore missed the RLUSD, Anchorage and Uniswap V4 positions entirely and understated Morpho by more than tenfold.`

interface Category {
  category: string
  own: boolean
  usd: number
  share: number
  color: string
}

interface Position {
  symbol: string
  network?: string
  label: string
  category: string
  usd: number
  share: number
  color: string
}

interface SllVenueData {
  totalUsd: number
  asOf: string
  categories: Category[]
  positions: Position[]
  ownShare: number
  externalShare: number
  sparkLendShare: number
  networks?: Array<{ network: string; usd: number; share: number }>
  meta: { source: string; note: string }
}

export function SllVenueBreakdown({ data }: { data: SllVenueData }) {
  const { categories, positions, totalUsd, meta } = data

  // Own vs external is computed server-side from Spark's own venue labels, so
  // the split does not silently break when a new venue appears.
  const sparkLendShare = data.sparkLendShare ?? 0
  const ownShare = data.ownShare ?? 0
  const externalShare = data.externalShare ?? 0

  // Fourteen venues, five of them holding under $200K between them, left the
  // legend taller than the chart. Fold anything under 0.5% into one row; the
  // position table beside it still lists every line in full.
  const shown = useMemo(() => {
    const big = categories.filter((c) => c.share >= 0.5)
    const dust = categories.filter((c) => c.share < 0.5)
    if (!dust.length) return big
    const usd = dust.reduce((t, c) => t + c.usd, 0)
    return [
      ...big,
      {
        category: `Other (${dust.length} venues)`,
        own: false,
        usd,
        share: dust.reduce((t, c) => t + c.share, 0),
        color: "#6B7280",
      },
    ]
  }, [categories])

  const donutData = useMemo(
    () => shown.map((c) => ({ name: c.category, value: c.usd, color: c.color })),
    [shown]
  )

  return (
    <ChartFrame
      title="SLL Deployment by Venue"
      subtitle={`Where the Liquidity Layer's $${(totalUsd / 1e9).toFixed(2)}B is allocated, all networks`}
      units="USD"
      source={meta.source}
      methodology={METHODOLOGY}
      height={420}
      footnote={
        <span>
          <strong>SparkLend alone takes {sparkLendShare.toFixed(1)}%</strong> of the Liquidity
          Layer, the single largest destination. Counting PSM3 and Spark Prime,{" "}
          <strong>{ownShare.toFixed(1)}%</strong> is redeployed into Spark&apos;s own products
          against <strong>{externalShare.toFixed(1)}%</strong> in external venues. So roughly
          half of what Sky lends Spark comes back into Spark&apos;s own lending market. The Q2
          2026 report framed the Liquidity Layer as routing into Morpho, Aave and Ethena; Aave,
          Curve, Ethena, Fluid and Maple together now hold under $200K of a $2.2B book.
        </span>
      }
    >
      <div style={{ height: 380 }} className="w-full flex items-start gap-4">
        {/* Donut + category legend on the left */}
        <div className="w-1/2 h-full flex flex-col min-w-0">
          <div style={{ height: 210 }} className="w-full shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={100}
                  paddingAngle={1}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {donutData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload
                    const pct = totalUsd > 0 ? (p.value / totalUsd) * 100 : 0
                    return (
                      <div className="custom-tooltip min-w-[180px]">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">{p.name}</span>
                          <span className="font-semibold text-text-primary">{formatUSD(p.value)}</span>
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
          {/* Category legend */}
          <div className="space-y-1 mt-2 overflow-y-auto min-h-0">
            {shown.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span className="text-text-secondary truncate">{c.category}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="text-text-muted text-[10px]">{c.share.toFixed(1)}%</span>
                  <span className="text-text-primary font-medium">{formatUSD(c.usd)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed position table on the right */}
        <div className="w-1/2 h-full overflow-y-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Position</th>
                <th>Category</th>
                <th className="text-right">USD</th>
                <th className="text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={`${p.category}-${p.symbol}-${p.network ?? ""}-${i}`}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: p.color }} />
                      <span className="text-text-primary">{p.label}</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-text-muted text-[10px] uppercase tracking-[0.05em]">{p.category}</span>
                  </td>
                  <td className="text-right tabular-nums text-text-primary">{formatUSD(p.usd)}</td>
                  <td className="text-right tabular-nums text-text-muted">{p.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartFrame>
  )
}
