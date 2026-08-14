"use client"

import { useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD } from "@/lib/utils"

const RANKED_METHODOLOGY = `Current outstanding loans (Ethereum only) across major DeFi lending venues. Each bar is the peer's live "borrowed" figure from DefiLlama.

Peer set: Aave V3, Morpho Blue, SparkLend, Fluid Lending, Compound V3, Euler V2. Spark is highlighted in accent orange; all peers use a neutral desaturated palette so competitive positioning reads at a glance.

Q2 2026 report cited Spark growing its share of outstanding loans from 4.3% → 10.4% over Q2 — a doubling while Aave interest income dropped 23% and Ethena fees dropped 21%. This chart shows where that trajectory now sits.`

const SHARE_METHODOLOGY = `Spark's share of tracked outstanding loans over time, computed as:

  sparklend_borrowed / sum(peer_borrowed) × 100

using DefiLlama's Ethereum-borrowed daily series across the same 6-peer set. Rebased to include SparkLend from launch.

Q2 2026 report anchor: Spark grew from 4.3% (start of Q2) to 10.4% (end of Q2). The reference lines mark those two levels.`

const PEER_META: Record<string, { color: string; label: string }> = {
  sparklend: { color: "#FF6B35", label: "SparkLend" },
  "aave-v3": { color: "#6B7280", label: "Aave V3" },
  "morpho-blue": { color: "#8B92A1", label: "Morpho Blue" },
  "fluid-lending": { color: "#4B5563", label: "Fluid Lending" },
  "compound-v3": { color: "#374151", label: "Compound V3" },
  "euler-v2": { color: "#525968", label: "Euler V2" },
}

interface PeersData {
  daily: Array<Record<string, number>>
  current: Array<{ slug: string; name: string; isSpark: boolean; borrow: number; share: number }>
  currentTotal: number
  currentSparkShare: number
}

export function PeerMarketShareRanked({ peers }: { peers: PeersData }) {
  const colors = useThemeColors()

  const data = peers.current.map((p) => ({
    name: p.name,
    borrow: p.borrow,
    share: p.share,
    isSpark: p.isSpark,
  }))

  const sparkRank = data.findIndex((d) => d.isSpark) + 1
  const sparkShare = peers.currentSparkShare.toFixed(1)

  return (
    <ChartFrame
      title="DeFi Lending Market Share (Ethereum)"
      subtitle={`Outstanding loans by protocol, current snapshot`}
      units="USD borrowed"
      source="DefiLlama Ethereum-borrowed across 6-peer lending set"
      methodology={RANKED_METHODOLOGY}
      height={300}
      footnote={
        <span>
          Q2 2026 report: Spark grew 4.3% → 10.4% during Q2. Live: Spark is #{sparkRank} with{" "}
          <strong>{sparkShare}%</strong> of ${formatUSD(peers.currentTotal).replace("$", "")} in tracked
          outstanding loans across 6 major venues.
        </span>
      }
    >
      <div style={{ height: 260 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 0, bottom: 0 }}
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
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textPrimary }}
              width={110}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <div className="custom-tooltip min-w-[180px]">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">{p.name}</span>
                      <span className="font-semibold text-text-primary">{formatUSD(p.borrow)}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-0.5">
                      <span className="text-text-muted">Market share</span>
                      <span className="text-text-muted">{p.share.toFixed(1)}%</span>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="borrow" radius={[0, 2, 2, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.isSpark ? "#FF6B35" : "#6B7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

type Period = "M" | "Q" | "ALL"

export function SparkShareOverTime({ peers }: { peers: PeersData }) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("ALL")

  const data = useMemo(() => {
    const raw = peers.daily
    if (period === "ALL") {
      // Downsample to weekly to keep the chart light.
      return raw.filter((_, i) => i % 7 === 0).map((d) => ({
        label: new Date((d.date as number) * 1000).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }),
        share: d.sparkShare,
      }))
    }
    // Bucket by month or quarter.
    const groups = new Map<string, { sum: number; count: number; anchor: number }>()
    const order: string[] = []
    const keyFor = (ts: number) => {
      const dt = new Date(ts * 1000)
      return period === "M"
        ? dt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
        : `Q${Math.ceil((dt.getUTCMonth() + 1) / 3)} ${dt.getUTCFullYear()}`
    }
    for (const d of raw) {
      const key = keyFor(d.date as number)
      if (!groups.has(key)) {
        groups.set(key, { sum: 0, count: 0, anchor: d.date as number })
        order.push(key)
      }
      const g = groups.get(key)!
      g.sum += d.sparkShare as number
      g.count++
    }
    // Keep the current partial period — share-of-market is a stock, not a
    // flow, so averaging fewer days is still a valid reading.
    return order.map((k) => ({ label: k, share: groups.get(k)!.sum / groups.get(k)!.count }))
  }, [peers.daily, period])

  const actions = (
    <div className="inline-flex rounded-sm border border-card-border overflow-hidden">
      {(["M", "Q", "ALL"] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className="px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] transition-colors"
          style={{
            background: period === p ? "var(--accent)" : "transparent",
            color: period === p ? "#0B0D11" : "var(--text-muted)",
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )

  return (
    <ChartFrame
      title="Spark Share of DeFi Lending Over Time"
      subtitle="SparkLend borrowed / (sum of 6-peer set borrowed)"
      units="% share of Ethereum lending"
      source="DefiLlama Ethereum-borrowed daily series"
      methodology={SHARE_METHODOLOGY}
      actions={actions}
      height={300}
      footnote={
        <span>
          Q2 2026 report anchors: <strong>4.3%</strong> (Q2 start) → <strong>10.4%</strong> (Q2 end).
          Live: <strong>{peers.currentSparkShare.toFixed(1)}%</strong>. Reference lines mark the Q2 anchor levels.
        </span>
      }
    >
      <div style={{ height: 260 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="sparkShareGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.05} />
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
              width={40}
            />
            <ReferenceLine y={4.3} stroke={colors.textMuted} strokeDasharray="3 3" strokeWidth={1} label={{ value: "Q2 start 4.3%", position: "insideBottomRight", fill: colors.textMuted, fontSize: 9 }} />
            <ReferenceLine y={10.4} stroke={colors.warning} strokeDasharray="3 3" strokeWidth={1} label={{ value: "Q2 end 10.4%", position: "insideTopRight", fill: colors.warning, fontSize: 9 }} />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="custom-tooltip min-w-[160px]">
                    <p className="text-xs text-text-muted mb-1">{label}</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Spark share</span>
                      <span className="font-semibold text-text-primary">{payload[0].value.toFixed(2)}%</span>
                    </div>
                  </div>
                )
              }}
              cursor={{ stroke: colors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="share"
              stroke="#FF6B35"
              strokeWidth={1.5}
              fill="url(#sparkShareGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
