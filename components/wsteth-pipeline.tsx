"use client"

import { useMemo } from "react"
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD } from "@/lib/utils"

const METHODOLOGY = `The wstETH → WETH loop is SparkLend's dominant flow. Users deposit wstETH as collateral, borrow WETH against it, sell/unwrap the WETH to buy more wstETH, then re-deposit — building levered exposure to the ETH staking yield.

This chart shows:
• wstETH collateral value on SparkLend (green area)
• WETH borrows (orange line)
• Implied utilisation of the loop = WETH borrow ÷ wstETH collateral value (right axis, dashed)

At full LTV (~72% for wstETH) the loop can compound leverage substantially. Watching the ratio contract tells you when leverage is unwinding — often a leading indicator of ETH liquid-staking rotation.

Q2 2026 report cited SparkLend as wstETH-dominated: $2.4B wstETH collateral vs $773M WETH borrowed at Q2 close, an implied loop utilisation of ~32%. Live shows the current ratio.`

interface DailyPoint {
  date: number
  tokens: Record<string, number>
}

interface Props {
  supplyTokens: DailyPoint[]
  borrowTokens: DailyPoint[]
}

export function WstEthPipeline({ supplyTokens, borrowTokens }: Props) {
  const colors = useThemeColors()

  const data = useMemo(() => {
    // Align on date. Supply-side wstETH value = liquidity[wstETH] + borrow[wstETH]
    // but borrow[wstETH] is ~0 (nobody borrows wstETH) so supply is enough.
    const borrowMap = new Map<number, Record<string, number>>()
    for (const p of borrowTokens) borrowMap.set(p.date, p.tokens)

    const rows = supplyTokens.map((p) => {
      const bTokens = borrowMap.get(p.date) || {}
      // Match token symbols case-insensitively (DefiLlama uppercases)
      const findKey = (obj: Record<string, number>, symbolLike: string) => {
        const upper = symbolLike.toUpperCase()
        for (const k of Object.keys(obj)) {
          if (k.toUpperCase() === upper) return obj[k]
        }
        return 0
      }
      const wstEthSupply = findKey(p.tokens, "WSTETH")
      const wstEthBorrow = findKey(bTokens, "WSTETH")
      const wethBorrow = findKey(bTokens, "WETH")
      const wstEthCollateral = wstEthSupply + wstEthBorrow // total supply-side
      const ratio = wstEthCollateral > 0 ? (wethBorrow / wstEthCollateral) * 100 : 0
      return {
        date: p.date,
        label: new Date(p.date * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        wstEthCollateral,
        wethBorrow,
        loopUtil: ratio,
      }
    })
    return rows
  }, [supplyTokens, borrowTokens])

  const latest = data.at(-1)
  const first = data[0]
  const wstEthNow = latest?.wstEthCollateral || 0
  const wethNow = latest?.wethBorrow || 0
  const loopNow = latest?.loopUtil || 0
  const loopThen = first?.loopUtil || 0
  const loopChange = loopNow - loopThen

  return (
    <ChartFrame
      title="wstETH → WETH Loop"
      subtitle="SparkLend's dominant flow: staker leverage looping via wstETH collateral / WETH borrow"
      units="USD (bars) · % (line)"
      source="DefiLlama /protocol/sparklend — Ethereum tokensInUsd + Ethereum-borrowed-tokensInUsd"
      methodology={METHODOLOGY}
      height={340}
      footnote={
        <span>
          Live: <strong>{formatUSD(wstEthNow)}</strong> wstETH collateral,{" "}
          <strong>{formatUSD(wethNow)}</strong> WETH borrowed, loop utilisation{" "}
          <strong>{loopNow.toFixed(1)}%</strong>.
          Q2 2026 report anchor: $2.4B wstETH / $773M WETH borrow = ~32% loop utilisation.
          {loopChange > 3 && " Loop utilisation is climbing — stakers are adding leverage."}
          {loopChange < -3 && " Loop utilisation is falling — stakers are unwinding leverage."}
        </span>
      }
    >
      <div style={{ height: 300 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="wstEthArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: colors.textMuted }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              yAxisId="usd"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={(v) => formatUSD(v)}
              width={60}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.warning }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              width={40}
              domain={[0, "auto"]}
            />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <div className="custom-tooltip min-w-[220px]">
                    <p className="text-xs text-text-muted mb-1.5">{label}</p>
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#22c55e" }} />
                        <span className="text-xs text-text-secondary">wstETH collateral</span>
                      </div>
                      <span className="text-xs font-medium text-text-primary">
                        {formatUSD(p.wstEthCollateral)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#FF6B35" }} />
                        <span className="text-xs text-text-secondary">WETH borrowed</span>
                      </div>
                      <span className="text-xs font-medium text-text-primary">
                        {formatUSD(p.wethBorrow)}
                      </span>
                    </div>
                    <div className="border-t border-card-border mt-1 pt-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-text-secondary">Loop utilisation</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: colors.warning }}>
                        {p.loopUtil.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              }}
              cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              yAxisId="usd"
              type="monotone"
              dataKey="wstEthCollateral"
              stroke="#22c55e"
              strokeWidth={1.5}
              fill="url(#wstEthArea)"
            />
            <Line
              yAxisId="usd"
              type="monotone"
              dataKey="wethBorrow"
              stroke="#FF6B35"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="loopUtil"
              stroke={colors.warning}
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
