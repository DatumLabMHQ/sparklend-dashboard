"use client"

import { useMemo } from "react"
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

const METHODOLOGY = `Borrower concentration on SparkLend, using per-wallet debt positions read from the pool contract's getUserAccountData for every active borrower discovered from Supply / Borrow events since the pool was deployed.

Metrics shown:
• Top-10 share = sum of top-10 borrowers' debt ÷ total protocol debt
• HHI (Herfindahl–Hirschman Index) = sum of (borrower share%)² — antitrust convention: <1500 = competitive, 1500–2500 = moderately concentrated, >2500 = concentrated.

High concentration is a two-sided signal. It usually means sophisticated leveraged plays (wstETH loopers, DAO treasuries running structured positions) rather than retail — those wallets tend to be sticky but also mean an unwind of one big position moves the pool.

Wallets are shown by address; if you recognize a wallet as a known entity (e.g. an institutional custodian, a DAO treasury), that's your story hook. Click any address to open Etherscan.`

interface WalletPosition {
  address: string
  totalDebt: number
  collateralAssets?: string[]
  borrowAssets?: string[]
}

interface Props {
  positions: WalletPosition[]
  totalDebt: number
}

export function WhaleConcentration({ positions, totalDebt }: Props) {
  const colors = useThemeColors()

  const { top10, top1Share, top10Share, hhi, borrowerCount } = useMemo(() => {
    const borrowers = positions
      .filter((p) => p.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt)
    const total = totalDebt || borrowers.reduce((s, p) => s + p.totalDebt, 0)
    const top10 = borrowers.slice(0, 10).map((p, i) => ({
      rank: i + 1,
      address: p.address,
      shortAddress: `${p.address.slice(0, 8)}…${p.address.slice(-6)}`,
      debt: p.totalDebt,
      share: total > 0 ? (p.totalDebt / total) * 100 : 0,
      borrowAssets: p.borrowAssets || [],
    }))
    const top1Share = top10[0]?.share || 0
    const top10Share = top10.reduce((s, r) => s + r.share, 0)
    const hhi = borrowers.reduce((s, p) => {
      const share = total > 0 ? (p.totalDebt / total) * 100 : 0
      return s + share * share
    }, 0)
    return {
      top10,
      top1Share,
      top10Share,
      hhi,
      borrowerCount: borrowers.length,
    }
  }, [positions, totalDebt])

  return (
    <ChartFrame
      title="SparkLend Borrower Concentration"
      subtitle="Top 10 borrowers by outstanding debt, share of protocol total"
      units="USD debt"
      source="On-chain: SparkLend Pool.getUserAccountData across every active borrower"
      methodology={METHODOLOGY}
      height={420}
      footnote={
        <span>
          Top borrower = <strong>{top1Share.toFixed(1)}%</strong> of all SparkLend debt (
          <strong>{formatUSD(top10[0]?.debt || 0)}</strong>). Top 10 = <strong>{top10Share.toFixed(1)}%</strong>{" "}
          across <strong>{borrowerCount.toLocaleString()}</strong> total borrowers. HHI = <strong>{hhi.toFixed(0)}</strong>{" "}
          ({hhi < 1500 ? "competitive" : hhi < 2500 ? "moderately concentrated" : "concentrated"}).
          When one wallet is &gt;15% of the pool, that wallet&apos;s unwind risk is the pool&apos;s tail risk.
        </span>
      }
    >
      <div style={{ height: 380 }} className="w-full flex gap-4">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top10}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: colors.textMuted }}
                tickFormatter={(v) => formatUSD(v)}
              />
              <YAxis
                type="category"
                dataKey="shortAddress"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: colors.textPrimary, fontFamily: "JetBrains Mono, monospace" }}
                width={130}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload
                  return (
                    <div className="custom-tooltip min-w-[220px]">
                      <p className="text-xs text-text-muted mb-1">Rank #{p.rank}</p>
                      <div className="text-[10px] text-text-secondary mb-1 font-mono">{p.address}</div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Debt</span>
                        <span className="font-semibold text-text-primary">{formatUSD(p.debt)}</span>
                      </div>
                      <div className="flex justify-between text-xs mt-0.5">
                        <span className="text-text-muted">Share of protocol</span>
                        <span className="text-text-muted">{p.share.toFixed(2)}%</span>
                      </div>
                      {p.borrowAssets?.length > 0 && (
                        <div className="text-[10px] text-text-muted mt-1">Borrows: {p.borrowAssets.join(", ")}</div>
                      )}
                    </div>
                  )
                }}
              />
              <Bar dataKey="debt" radius={[0, 2, 2, 0]}>
                {top10.map((r, i) => (
                  <Cell
                    key={i}
                    fill={
                      i === 0
                        ? "#FF6B35" // top whale in accent
                        : r.share > 5
                          ? "#F59E0B" // >5% share in warning
                          : "#6B7280" // rest muted
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 h-full overflow-y-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Wallet</th>
                <th className="text-right">Debt</th>
                <th className="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r) => (
                <tr key={r.address}>
                  <td className="text-text-muted tabular-nums">{r.rank}</td>
                  <td>
                    <a
                      href={`https://etherscan.io/address/${r.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-primary hover:text-accent transition-colors"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      {r.shortAddress} ↗
                    </a>
                    {r.borrowAssets?.length > 0 && (
                      <div className="text-[9px] text-text-muted mt-0.5">{r.borrowAssets.join(" · ")}</div>
                    )}
                  </td>
                  <td className="text-right tabular-nums text-text-primary">{formatUSD(r.debt)}</td>
                  <td className="text-right tabular-nums text-text-muted">{r.share.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartFrame>
  )
}
