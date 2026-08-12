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

Q2 2026 report described SLL as deploying into Morpho, Aave, and Ethena. Live shows most of the balance sheet has moved into Spark's own Vault V2 products — Spark now largely self-curates rather than outsourcing yield.`

interface Category {
  category: string
  usd: number
  share: number
  color: string
}

interface Position {
  symbol: string
  label: string
  category: string
  usd: number
  share: number
  color: string
}

interface SllVenueData {
  totalUsd: number
  asOf: number
  categories: Category[]
  positions: Position[]
  meta: { source: string; note: string }
}

export function SllVenueBreakdown({ data }: { data: SllVenueData }) {
  const { categories, positions, totalUsd, meta } = data

  const sparkVaultShare = categories.find((c) => c.category === "Spark Vault V2")?.share ?? 0
  const externalShare = categories
    .filter((c) => ["Morpho Blue", "Aave V3", "Yield tokens"].includes(c.category))
    .reduce((s, c) => s + c.share, 0)
  const idleShare = categories.find((c) => c.category === "Direct stablecoins")?.share ?? 0

  const donutData = useMemo(
    () => categories.map((c) => ({ name: c.category, value: c.usd, color: c.color })),
    [categories]
  )

  return (
    <ChartFrame
      title="SLL Deployment by Venue"
      subtitle={`Where SLL's $${(totalUsd / 1e9).toFixed(2)}B is currently parked on Ethereum`}
      units="USD"
      source={meta.source}
      methodology={METHODOLOGY}
      height={420}
      footnote={
        <span>
          Q2 2026 report framing: SLL routes into Morpho, Aave, Ethena.
          Live: <strong>Spark Vault V2 {sparkVaultShare.toFixed(1)}%</strong> ·
          external yield venues (Morpho + Aave + Ethena/Maple) {externalShare.toFixed(1)}% ·
          idle stablecoins {idleShare.toFixed(1)}%.
          Spark has quietly insourced most of SLL — worth a thread on how the "capital allocator"
          increasingly allocates to itself.
        </span>
      }
    >
      <div style={{ height: 380 }} className="w-full flex items-start gap-4">
        {/* Donut + category legend on the left */}
        <div className="w-1/2 h-full flex flex-col">
          <div className="flex-1">
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
          <div className="space-y-1 mt-2">
            {categories.map((c) => (
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
              {positions.map((p) => (
                <tr key={p.symbol}>
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
