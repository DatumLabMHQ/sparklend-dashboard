"use client"

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD } from "@/lib/utils"

const METHODOLOGY = `Top-20 SPK token holders on Ethereum, indexed by Ethplorer.

Categories:
• Vesting / lock — team, investor, foundation escrows. Usually the biggest single line.
• Protocol treasury — SPARK_PROXY (0x3300...f8c4), Spark's own on-chain treasury.
• CEX — known centralized exchange cold wallets (Binance is the notable one for SPK).
• DEX / LP — DEX pool addresses providing SPK liquidity.
• Unknown — everything else. Watch these for accumulation clues.

Share is % of the tracked balance across the top 20, not % of circulating supply. HHI (Herfindahl-Hirschman Index) on those 20 gives a concentration reading — SPK's is dominated by a single vesting line, so treat it as "who holds among the tradable float" rather than "who holds among the paper cap."`

function formatSpk(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B SPK`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M SPK`
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K SPK`
  return `${n.toFixed(0)} SPK`
}

interface Holder {
  rank: number
  address: string
  shortAddress: string
  label: string | null
  category: string
  color: string
  tokenBalance: number
  share: number
}

interface Category {
  category: string
  share: number
  count: number
  color: string
}

interface Props {
  data: {
    holders: Holder[]
    categories: Category[]
    hhi: number
    meta: { source: string; knownCount: number; note: string }
  }
  currentSpkPrice?: number
}

export function SpkHolderDistribution({ data, currentSpkPrice }: Props) {
  const colors = useThemeColors()
  const { holders, categories, hhi, meta } = data

  const top10 = holders.slice(0, 10)
  const top1Share = top10[0]?.share || 0
  const top10Share = top10.reduce((s, h) => s + h.share, 0)

  return (
    <ChartFrame
      title="SPK Top Token Holders"
      subtitle={`Top 20 on Ethereum — ${meta.knownCount} identified, ${20 - meta.knownCount} unknown`}
      units="% of top-20 tracked balance"
      source={meta.source}
      methodology={METHODOLOGY}
      height={460}
      footnote={
        <span>
          Top holder = <strong>{top1Share.toFixed(1)}%</strong> of the tracked balance (a vesting / airdrop
          escrow), Top 10 = <strong>{top10Share.toFixed(1)}%</strong>. HHI on the top 20 ={" "}
          <strong>{hhi.toFixed(0)}</strong>. The story hook is usually the &quot;Unknown&quot; category —
          when a wallet nobody has labelled starts accumulating SPK, that&apos;s a signal worth digging into.
        </span>
      }
    >
      <div style={{ height: 420 }} className="w-full flex gap-4">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top10}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: colors.textMuted }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <YAxis
                type="category"
                dataKey="shortAddress"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: colors.textPrimary, fontFamily: "JetBrains Mono, monospace" }}
                width={140}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload
                  const usd = currentSpkPrice ? p.tokenBalance * currentSpkPrice : 0
                  return (
                    <div className="custom-tooltip min-w-[240px]">
                      <p className="text-xs text-text-muted mb-1">
                        #{p.rank} · <span className="uppercase tracking-[0.05em]">{p.category}</span>
                      </p>
                      {p.label && (
                        <p className="text-xs text-text-primary font-medium mb-1">{p.label}</p>
                      )}
                      <div className="text-[10px] text-text-secondary mb-1 font-mono">{p.address}</div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Balance</span>
                        <span className="font-semibold text-text-primary">{formatSpk(p.tokenBalance)}</span>
                      </div>
                      {currentSpkPrice && (
                        <div className="flex justify-between text-xs mt-0.5">
                          <span className="text-text-muted">USD value</span>
                          <span className="text-text-muted">{formatUSD(usd)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs mt-0.5">
                        <span className="text-text-muted">Share of top 20</span>
                        <span className="text-text-muted">{p.share.toFixed(2)}%</span>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="share" radius={[0, 2, 2, 0]}>
                {top10.map((h, i) => (
                  <Cell key={i} fill={h.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 h-full overflow-y-auto">
          {/* Category legend */}
          <div className="mb-3 space-y-1">
            {categories.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span className="text-text-secondary">{c.category}</span>
                  <span className="text-text-muted text-[9px]">×{c.count}</span>
                </div>
                <span className="text-text-primary tabular-nums font-medium">{c.share.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Wallet / Label</th>
                <th className="text-right">SPK</th>
                <th className="text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {holders.slice(0, 15).map((h) => (
                <tr key={h.address}>
                  <td className="text-text-muted tabular-nums">{h.rank}</td>
                  <td>
                    <a
                      href={`https://etherscan.io/address/${h.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-primary hover:text-accent transition-colors"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {h.shortAddress} ↗
                    </a>
                    {h.label && (
                      <div className="text-[9px] text-text-muted mt-0.5">{h.label}</div>
                    )}
                    {!h.label && (
                      <div className="text-[9px] text-text-muted mt-0.5 italic">Unknown</div>
                    )}
                  </td>
                  <td className="text-right tabular-nums text-text-primary text-[10px]">
                    {formatSpk(h.tokenBalance)}
                  </td>
                  <td className="text-right tabular-nums text-text-muted">{h.share.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartFrame>
  )
}
