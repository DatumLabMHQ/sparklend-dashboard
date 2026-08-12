"use client"

import { useState, useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { PeriodToggle, type Period } from "./period-toggle"
import { aggregateData } from "./aggregate"

const METHODOLOGY = `Share of net revenue coming from Sky's monthly Distribution Reward settlements, calculated as:

  distributionRewards / (netInterestIncome + flashloanFees + liquidationFees + sllRevenue + distributionRewards)

The Q2 2026 report cited Distribution Rewards at approximately 74% of net revenue. As long as SLL yields compress and lending-spread income stays soft, Distribution Rewards remain the dominant line — an important framing for anyone modelling Spark's earnings quality.

Since Distribution Rewards started in September 2025, values before then are 0. The 74% reference line marks the Q2 anchor.

Note: The share can exceed 100% in periods where SLL revenue turns negative (funding cost > yield). That's the honest signal that Distribution Rewards alone are more than offsetting a net loss on other lines — worth flagging in a monthly write-up.`

interface Point {
  date: number
  netInterestIncome: number
  flashloanFees: number
  liquidationFees: number
  sllRevenue: number
  distributionRewards: number
}

export function DistRewardsShareChart({ daily }: { daily: Point[] }) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("M")

  // Compute distribution rewards share per day, then bucket into periods.
  const withShare = useMemo(
    () =>
      daily.map((d) => {
        const total =
          (d.netInterestIncome || 0) +
          (d.flashloanFees || 0) +
          (d.liquidationFees || 0) +
          (d.sllRevenue || 0) +
          (d.distributionRewards || 0)
        const share = total > 0 ? ((d.distributionRewards || 0) / total) * 100 : 0
        return { date: d.date, distShare: share, dist: d.distributionRewards || 0, total }
      }),
    [daily]
  )

  const bucketed = useMemo(
    () => aggregateData(withShare as any, period, ["dist", "total"]),
    [withShare, period]
  )

  // Per-bucket share = sum(dist) / sum(total) for the bucket. Doing the ratio
  // AFTER summing avoids the "average of ratios" trap where a low-total day
  // with 100% dist dominates the mean.
  const data = bucketed.map((b: any) => ({
    label: b.label,
    share: b.total > 0 ? (b.dist / b.total) * 100 : 0,
    dist: b.dist,
    total: b.total,
  }))

  // Trailing 30d share for the footnote.
  const recent = withShare.slice(-30)
  const recentDist = recent.reduce((s, d) => s + d.dist, 0)
  const recentTotal = recent.reduce((s, d) => s + d.total, 0)
  const recent30dShare = recentTotal > 0 ? (recentDist / recentTotal) * 100 : 0

  return (
    <ChartFrame
      title="Distribution Rewards Share of Net Revenue"
      subtitle="Percent of net revenue from Sky's monthly USDS settlement to SPARK_PROXY"
      units="% of net revenue"
      source="Derived from /api/financials — DefiLlama + on-chain scans"
      methodology={METHODOLOGY}
      actions={<PeriodToggle selected={period} onChange={setPeriod} />}
      height={280}
      footnote={
        <span>
          Q2 2026 report cited Distribution Rewards at <strong>~74%</strong> of net revenue.
          Trailing 30-day share here reads <strong>{recent30dShare.toFixed(1)}%</strong>.
          {recent30dShare > 80 && " Higher than the report — SLL yields have compressed since Q2 close."}
          {recent30dShare < 50 && " Lower than the report — non-Distribution revenue lines have recovered."}
        </span>
      }
    >
      <div style={{ height: 240 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="distShare" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
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
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              domain={[0, "auto"]}
              width={40}
            />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <div className="custom-tooltip min-w-[180px]">
                    <p className="text-xs text-text-muted mb-1.5">{label}</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Dist. Rewards share</span>
                      <span className="font-semibold text-text-primary">{p.share.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs mt-0.5">
                      <span className="text-text-muted">Total net revenue</span>
                      <span className="text-text-muted">${(p.total / 1000).toFixed(0)}k</span>
                    </div>
                  </div>
                )
              }}
              cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <ReferenceLine
              y={74}
              stroke={colors.warning}
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "Q2 report: 74%",
                position: "insideTopRight",
                fill: colors.warning,
                fontSize: 9,
              }}
            />
            <Area
              type="monotone"
              dataKey="share"
              stroke="#a855f7"
              strokeWidth={1.5}
              fill="url(#distShare)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
