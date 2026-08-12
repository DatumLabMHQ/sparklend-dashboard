"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD, getTokenColor, getTokenName } from "@/lib/utils"

const METHODOLOGY = `Composition of SparkLend collateral, i.e. total supply-side value on Ethereum broken down by asset.

Concentration matters for risk: SparkLend's collateral base has been ~57% wstETH for most of 2026, meaning wstETH price shocks (a Lido restaking event, a Rocket Pool competitor spike, a Sky governance change) show up disproportionately on Spark. The Q2 2026 report highlighted the wstETH → WETH borrow pipeline as SparkLend's dominant flow, with ~$773M of WETH borrowed against ~$2.4B of wstETH collateral.

Data: DefiLlama per-token supply snapshots (latest daily value). Assets below 2% of total are rolled into "Other" to keep the donut readable.`

interface CollateralConcentrationProps {
  /** Latest per-token supply-side USD, e.g. { WSTETH: 2400000000, WETH: 200000000, ... } */
  tokens: Record<string, number>
  /** Latest per-token borrow-side USD (for the WETH borrow footnote). */
  borrowTokens?: Record<string, number>
}

const SMALL_SLICE_PCT = 2

export function CollateralConcentration({ tokens, borrowTokens }: CollateralConcentrationProps) {
  const colors = useThemeColors()

  const { slices, total, wstEthPct, wethBorrow } = useMemo(() => {
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
    const slices = big.map((e, i) => ({
      name: getTokenName(e.symbol),
      symbol: e.symbol,
      value: e.value,
      color: e.symbol.toUpperCase().includes("WSTETH")
        ? "#FF6B35" // Spark accent for the dominant asset
        : getTokenColor(i + 1), // shifted so wstETH stays orange
    }))
    if (smallSum > 0) {
      slices.push({
        name: "Other",
        symbol: "OTHER",
        value: smallSum,
        color: colors.textMuted,
      })
    }

    const wstEthEntry = entries.find((e) => e.symbol.toUpperCase().includes("WSTETH"))
    const wstEthPct = wstEthEntry && total > 0 ? (wstEthEntry.value / total) * 100 : 0

    // WETH borrow lookup: match "WETH" exactly (not wstETH).
    let wethBorrow = 0
    if (borrowTokens) {
      for (const [k, v] of Object.entries(borrowTokens)) {
        if (k.toUpperCase() === "WETH") wethBorrow = v || 0
      }
    }

    return { slices, total, wstEthPct, wethBorrow }
  }, [tokens, borrowTokens, colors.textMuted])

  return (
    <ChartFrame
      title="SparkLend Collateral Concentration"
      subtitle="Total supply-side value by asset (Ethereum only)"
      units="USD"
      source="DefiLlama /protocol/sparklend — Ethereum tokensInUsd"
      methodology={METHODOLOGY}
      height={300}
      footnote={
        <span>
          Q2 2026 report cited wstETH at ~57% of collateral ($2.4B), $773M WETH borrowed. Live:
          wstETH <strong>{wstEthPct.toFixed(1)}%</strong> of ${formatUSD(total).replace("$", "")} collateral
          {wethBorrow > 0 && <> · WETH borrow <strong>{formatUSD(wethBorrow)}</strong></>}.
        </span>
      }
    >
      <div style={{ height: 260 }} className="w-full flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
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
                    <div className="custom-tooltip min-w-[180px]">
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
        <div className="w-1/2 pl-4 space-y-1">
          {slices.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0
            return (
              <div key={s.symbol} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-text-secondary truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="text-text-muted text-[10px]">{pct.toFixed(1)}%</span>
                  <span className="text-text-primary font-medium">{formatUSD(s.value)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ChartFrame>
  )
}
