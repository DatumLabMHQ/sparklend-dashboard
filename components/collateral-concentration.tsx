"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD, getTokenColor, getTokenName } from "@/lib/utils"

const METHODOLOGY = `Composition of SparkLend positions on Ethereum:
• Left donut — supply-side value by asset (total supplied, aka collateral).
• Right donut — borrow-side value by asset (outstanding loans).

Concentration matters for risk. SparkLend's collateral base has been ~57% wstETH for most of 2026, meaning wstETH price shocks (Lido restaking events, Rocket Pool spikes, Sky governance changes) show up disproportionately on Spark. On the borrow side, WETH usually dominates — the wstETH→WETH loop is the pool's largest flow.

Data: DefiLlama per-token snapshots (latest daily value). Assets below 2% of their side are folded into "Other" to keep the donuts readable.`

const SMALL_SLICE_PCT = 2

interface Props {
  /** Latest per-token supply-side USD */
  supplyTokens: Record<string, number>
  /** Latest per-token borrow-side USD */
  borrowTokens: Record<string, number>
}

interface Slice {
  name: string
  symbol: string
  value: number
  color: string
}

function summarize(
  tokens: Record<string, number>,
  accentToken: string,
  mutedColor: string
): { slices: Slice[]; total: number; topPct: number; topName: string } {
  const entries = Object.entries(tokens)
    .map(([symbol, value]) => ({ symbol, value: value || 0 }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = entries.reduce((s, e) => s + e.value, 0)
  const big: typeof entries = []
  let smallSum = 0
  for (const e of entries) {
    const pct = total > 0 ? (e.value / total) * 100 : 0
    if (pct >= SMALL_SLICE_PCT) big.push(e)
    else smallSum += e.value
  }
  const slices: Slice[] = big.map((e, i) => ({
    name: getTokenName(e.symbol),
    symbol: e.symbol,
    value: e.value,
    color: e.symbol.toUpperCase() === accentToken
      ? "#FF6B35" // Spark accent for the dominant asset on this side
      : getTokenColor(i + 1),
  }))
  if (smallSum > 0) {
    slices.push({
      name: "Other",
      symbol: "OTHER",
      value: smallSum,
      color: mutedColor,
    })
  }

  const topName = slices[0]?.name || "—"
  const topPct = total > 0 && slices[0] ? (slices[0].value / total) * 100 : 0

  return { slices, total, topPct, topName }
}

function DonutHalf({
  title,
  slices,
  total,
  side,
}: {
  title: string
  slices: Slice[]
  total: number
  side: "left" | "right"
}) {
  return (
    <div className="w-1/2 h-full flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-1 px-1">
        {title}
        <span className="ml-2 text-text-primary font-medium tabular-nums normal-case tracking-normal">
          {formatUSD(total)}
        </span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="w-2/5 h-full min-w-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={40}
                outerRadius={72}
                paddingAngle={1}
                stroke="none"
              >
                {slices.map((s) => (
                  <Cell key={s.symbol} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload
                  const pct = total > 0 ? (p.value / total) * 100 : 0
                  return (
                    <div className="custom-tooltip min-w-[160px]">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">{p.name}</span>
                        <span className="font-semibold text-text-primary">
                          {formatUSD(p.value)}
                        </span>
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
        <div className="flex-1 overflow-y-auto pr-1 space-y-1">
          {slices.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0
            return (
              <div key={s.symbol} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-text-secondary truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span className="text-text-muted">{pct.toFixed(1)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CollateralConcentration({ supplyTokens, borrowTokens }: Props) {
  const colors = useThemeColors()

  const supply = useMemo(
    () => summarize(supplyTokens, "WSTETH", colors.textMuted),
    [supplyTokens, colors.textMuted]
  )
  const borrow = useMemo(
    () => summarize(borrowTokens, "WETH", colors.textMuted),
    [borrowTokens, colors.textMuted]
  )

  return (
    <ChartFrame
      title="SparkLend Collateral & Borrow Mix"
      subtitle="Latest per-asset breakdown of what's deposited vs what's borrowed"
      units="USD (Ethereum)"
      source="DefiLlama /protocol/sparklend — Ethereum tokensInUsd (supply + borrow)"
      methodology={METHODOLOGY}
      height={340}
      footnote={
        <span>
          Supply-side top asset: <strong>{supply.topName}</strong>{" "}
          ({supply.topPct.toFixed(1)}%). Borrow-side top asset:{" "}
          <strong>{borrow.topName}</strong> ({borrow.topPct.toFixed(1)}%).
          The wstETH → WETH pipeline visible when both are dominant is
          SparkLend&apos;s signature leverage-stake loop. Q2 2026 report cited
          wstETH ~57% of collateral and WETH ~$773M of borrows.
        </span>
      }
    >
      <div style={{ height: 300 }} className="w-full flex gap-4 px-2">
        <DonutHalf title="Supply / Collateral" slices={supply.slices} total={supply.total} side="left" />
        <div className="w-px bg-card-border" />
        <DonutHalf title="Borrow" slices={borrow.slices} total={borrow.total} side="right" />
      </div>
    </ChartFrame>
  )
}
