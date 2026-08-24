"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatUSD } from "@/lib/utils"
import { PeriodToggle, type Period } from "./period-toggle"
import { aggregateData } from "./aggregate"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"

const METHODOLOGY = `Spark Total Revenue, defined to match Blockworks Research's Spark financials page. Five streams:

Sparklend: Protocol treasury's share of borrower interest across SparkLend markets, determined by each asset's Reserve Factor. USDS and DAI reserves are excluded to match Blockworks Research (Sky pays for those two via Distribution Rewards instead). Combines net interest, flashloan premiums, and liquidation bonuses since these are all SparkLend-channel revenue. Toggle Flashloan and Liquidation legend entries to separate them out.

Spark Liquidity Layer (SLL): Yield on the ALM Proxy's book (0x1601843c5E9bC251A3272907010AFa41Fa18347E), net of the Sky Base Rate it pays to fund that book.\n\nThis is Spark's OWN published figure, not a Datum Labs computation and not a DefiLlama one. DefiLlama's adapter is a passthrough of a Dune table Spark publishes themselves (dune.sparkdotfi.result_spark_sll_actual_revenue_daily), and it explicitly permits negative values. Negative months are therefore real: when the Sky Base Rate exceeds what the book earns, the Liquidity Layer runs at a net loss.\n\nWhere the capital actually sits, read on-chain 24 Aug 2026: $1.57B in SparkLend aTokens (spUSDS, spDAI, spUSDT, spPYUSD, spUSDC), $666M in sUSDS, $238.8M in idle PYUSD, and $22.4M in Spark-branded Morpho vaults. So 62.8% of the Liquidity Layer's book is deposited into Spark's own lending market, and under 1% sits in external venues.\n\nDisagreement worth knowing: Blockworks Research models this same metric on an independent pipeline and gets a materially different answer. For July 2026 Spark's own books show -$54K while Blockworks shows $965K, a $1.02M gap. Neither is adjusted to fit the other here.

Distribution Rewards: Rate-based accrual paid by Sky to Spark for growing USDS/sUSDS demand (base ~20 bps/yr on tagged USDS balance, up to +30 bps boost). Settled once per Monthly Settlement Cycle as an on-chain USDS mint from MCD Pause Proxy (0xbE28...38f3) to Spark Proxy (0x3300...f8c4). We approximate the accrual by spreading total cumulative mints evenly across every day since program launch (Sept 1, 2025) — matches Blockworks Research's methodology and neutralises settlement-timing lumps (e.g. Sam MacPherson's July 2026 backlog).

Vault Curation: Performance fees SparkDAO earns as curator of Spark-branded Morpho vaults. Currently tracked as $0 pending Morpho GraphQL integration; Blockworks reports this typically runs at or near zero anyway.

Liquidation: SparkLend liquidation-bonus fees (protocol's share, ~10%).

Data: DefiLlama (sparklend + spark-liquidity-layer slugs) plus on-chain event scanning for flashloan, liquidation and Distribution Reward settlements.

Where each line comes from, and how far it sits from Blockworks:
  • Sparklend: our computation. USDS + DAI reserves stripped from the reserve-factor share using a live on-chain ratio, matching Blockworks' stated methodology. July ran about 14% under their figure.
  • Distribution Rewards: our computation. Flat-rate accrual of capped on-chain settlement mints since Sept 2025, which avoids attributing a multi-month backlog to the single month it lands in. July ran about 15% under their figure.
  • SLL: Spark's own published number, passed through unmodified. Blockworks models it independently and differs by $1.02M in July. We report Spark's figure and name the gap rather than splitting the difference.
  • Vault Curation: not yet tracked, shown as $0.

An independent reconstruction of the SLL line from on-chain logs is in progress, which would let this dashboard adjudicate the Spark-vs-Blockworks gap rather than only report it.`

interface RevenueChartProps {
  daily: Array<{ date: number; netInterestIncome: number; flashloanFees: number; liquidationFees: number; sllRevenue: number; distributionRewards: number; vaultCuration?: number }>
}

// Matches the Blockworks Research Spark: Total Revenue chart legend order.
// Vault Curation is a placeholder until the Morpho GraphQL fetch lands
// (Blockworks reports it typically ~$0 so the visual impact is negligible).
const STREAMS = [
  { key: "netInterestIncome", label: "Sparklend", color: "#3b82f6" },
  { key: "sllRevenue", label: "Spark Liquidity Layer", color: "#f59e0b" },
  { key: "distributionRewards", label: "Distribution Rewards", color: "#a855f7" },
  { key: "vaultCuration", label: "Vault Curation", color: "#10b981" },
  { key: "flashloanFees", label: "Flashloan", color: "#06b6d4" },
  { key: "liquidationFees", label: "Liquidation", color: "#ef4444" },
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p: any) => p.value !== 0 && p.value != null)
  const total = items.reduce((s: number, p: any) => s + p.value, 0)
  const isIncomplete = payload[0]?.payload?.isIncomplete

  return (
    <div className="custom-tooltip min-w-[200px]">
      <p className="text-xs text-text-muted mb-1.5">
        {label}
        {isIncomplete ? " · partial" : ""}
      </p>
      {items.map((item: any) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill || item.color }} />
            <span className="text-xs text-text-secondary">{STREAMS.find((s) => s.key === item.dataKey)?.label || item.dataKey}</span>
          </div>
          <span className="text-xs font-medium text-text-primary">{formatUSD(item.value)}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div className="border-t border-card-border mt-1 pt-1 flex justify-between">
          <span className="text-xs text-text-secondary">Total</span>
          <span className="text-xs font-semibold text-text-primary">{formatUSD(total)}</span>
        </div>
      )}
    </div>
  )
}

export function RevenueChart({ daily }: RevenueChartProps) {
  const colors = useThemeColors()
  const [period, setPeriod] = useState<Period>("M")
  const [visible, setVisible] = useState<Record<string, boolean>>({
    netInterestIncome: true,
    sllRevenue: true,
    distributionRewards: true,
    vaultCuration: true,
    flashloanFees: true,
    liquidationFees: true,
  })

  const chartData = useMemo(
    () => aggregateData(daily, period, STREAMS.map((s) => s.key)),
    [daily, period]
  )

  const toggleStream = (key: string) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }))
  }

  const chartActions = (
    <PeriodToggle selected={period} onChange={setPeriod} />
  )

  return (
    <ChartFrame
      title="Spark Total Revenue"
      subtitle="Sparklend, Spark Liquidity Layer, Distribution Rewards, Vault Curation and Liquidation, after funding cost"
      units="USD"
      source="Spark's published SLL accounting (via DefiLlama) + DefiLlama sparklend + on-chain USDS mints"
      methodology={METHODOLOGY}
      actions={chartActions}
      height={320}
      footnote={
        <span>
          The Liquidity Layer line is Spark's own published figure, so negative months are real
          rather than an artifact: they are months where the Sky Base Rate exceeded what the book
          earned. Blockworks Research models the same metric independently and differs by $1.02M in
          July 2026; that gap is named in the methodology, not averaged away. The last bar covers the
          current partial period and the tooltip labels it "partial".
        </span>
      }
    >
      <div className="flex items-center gap-4 px-1 mb-2 mt-1">
        {STREAMS.map((s) => (
          <button
            key={s.key}
            onClick={() => toggleStream(s.key)}
            className={`flex items-center gap-1.5 text-[11px] transition-opacity ${visible[s.key] ? "opacity-100" : "opacity-40"}`}
          >
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-text-secondary">{s.label}</span>
          </button>
        ))}
      </div>

      <div style={{ height: 280 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: colors.textMuted }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textMuted }} tickFormatter={(v) => formatUSD(v)} width={60} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            {STREAMS.map(
              (s) =>
                visible[s.key] && (
                  <Bar key={s.key} dataKey={s.key} stackId="1" fill={s.color} radius={[0, 0, 0, 0]} />
                )
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
