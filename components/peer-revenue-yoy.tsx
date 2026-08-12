"use client"

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD } from "@/lib/utils"

const METHODOLOGY = `Per-protocol revenue growth: trailing 90-day revenue vs the prior 90-day window (day 91-180), as reported by DefiLlama's dailyRevenue series for each protocol.

This is the closest live proxy for the Q2 2026 narrative that "Aave interest income dropped 23%, Ethena fees dropped 21%" — a lending-cycle chart showing who's compressing and who's growing.

Morpho is excluded because DefiLlama's fee endpoint returns 0 for morpho / morpho-blue (their fee model is curator-based rather than protocol-level, so it doesn't fit the standard series). Spark's own SLL sits below the chart in a callout — it's Spark's product, not a peer.

Spark is highlighted in accent orange; peers use a neutral grey/desaturated palette so the competitive story reads at a glance.`

interface Peer {
  slug: string
  name: string
  isSpark: boolean
  recent90d: number
  prior90d: number
  yoyPct: number | null
}

interface Props {
  peers: Peer[]
  sll: { name: string; recent90d: number; prior90d: number; yoyPct: number | null }
  window: { days: number }
}

export function PeerRevenueYoY({ peers, sll, window }: Props) {
  const colors = useThemeColors()
  const data = peers.map((p) => ({
    name: p.name,
    yoy: p.yoyPct || 0,
    recent: p.recent90d,
    prior: p.prior90d,
    isSpark: p.isSpark,
  }))
  const sparkRank = [...data].sort((a, b) => b.yoy - a.yoy).findIndex((d) => d.isSpark) + 1
  const sparkYoy = data.find((d) => d.isSpark)?.yoy || 0
  const peersDownCount = data.filter((d) => !d.isSpark && d.yoy < 0).length
  const peersDownAvg =
    peersDownCount > 0
      ? data.filter((d) => !d.isSpark && d.yoy < 0).reduce((s, d) => s + d.yoy, 0) / peersDownCount
      : 0

  return (
    <ChartFrame
      title="Lending Revenue: 90-day vs Prior 90-day"
      subtitle={`YoY-style revenue change across the DeFi lending peer set (${window.days}d windows)`}
      units="% change"
      source="DefiLlama /summary/fees/{peer} dailyRevenue"
      methodology={METHODOLOGY}
      height={320}
      footnote={
        <span>
          <strong>Spark rank: #{sparkRank}</strong> with{" "}
          <strong className={sparkYoy >= 0 ? "text-positive" : "text-danger"}>
            {sparkYoy >= 0 ? "+" : ""}
            {sparkYoy.toFixed(1)}%
          </strong>{" "}
          revenue change (trailing 90d vs prior 90d).
          {peersDownCount > 0 && (
            <>
              {" "}
              {peersDownCount} of {data.length - 1} peers down (avg {peersDownAvg.toFixed(1)}%).
            </>
          )}{" "}
          Q2 2026 report cited Aave interest income -23%, Ethena fees -21% during Q2 — the live picture is
          worse for most, better for Spark.
          {sll.yoyPct !== null && Math.abs(sll.yoyPct) > 30 && (
            <>
              {" "}
              (Aside: Spark&apos;s own SLL revenue is <strong className="text-danger">{sll.yoyPct.toFixed(1)}%</strong>{" "}
              — internal divergence worth flagging alongside the peer story.)
            </>
          )}
        </span>
      }
    >
      <div style={{ height: 280 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 50, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: colors.textPrimary }}
              width={110}
            />
            <ReferenceLine x={0} stroke={colors.textMuted} strokeWidth={1} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <div className="custom-tooltip min-w-[220px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-secondary">{p.name}</span>
                      <span
                        className="font-semibold"
                        style={{ color: p.yoy >= 0 ? colors.success : colors.danger }}
                      >
                        {p.yoy >= 0 ? "+" : ""}
                        {p.yoy.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-text-muted">
                      <span>Recent 90d</span>
                      <span>{formatUSD(p.recent)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-text-muted">
                      <span>Prior 90d</span>
                      <span>{formatUSD(p.prior)}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="yoy" radius={[0, 2, 2, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.isSpark
                      ? "#FF6B35"
                      : d.yoy >= 0
                        ? "#22c55e"
                        : "#6B7280"
                  }
                />
              ))}
              <LabelList
                dataKey="yoy"
                position="right"
                formatter={(v: any) => `${(typeof v === "number" ? v : 0) >= 0 ? "+" : ""}${(typeof v === "number" ? v : 0).toFixed(1)}%`}
                fill={colors.textPrimary}
                fontSize={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
