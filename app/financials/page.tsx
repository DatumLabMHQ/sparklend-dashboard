"use client"

import { IncomeStatement } from "@/components/financials/income-statement"
import { SpreadChart } from "@/components/financials/spread-chart"
import { RevenueByProduct } from "@/components/financials/revenue-by-product"
import { MarginChart } from "@/components/financials/margin-chart"
import { SourceComparison } from "@/components/financials/source-comparison"
import { formatUSD, formatUSDFull } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-32 bg-card-bg rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card-bg border border-card-border rounded-lg" />
        ))}
      </div>
      <div className="h-[340px] bg-card-bg border border-card-border rounded-lg" />
      <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
    </div>
  )
}

function monthLabel(m: string) {
  const [y, mm] = m.split("-")
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  return `${names[Number(mm) - 1]} ${y}`
}

export default function FinancialsPage() {
  const { data, loading, error } = useCachedFetch("/api/financials", { ttl: 15 * 60_000 })

  if (loading) return <LoadingSkeleton />

  if (error || !data || data.error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="text-center py-12">
          <p className="text-danger text-sm">{error || data?.error || "Failed to load financials"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-card-bg border border-card-border rounded-md text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { monthly = [], sllDaily = [], sourceComparison = [], latest, prior, spreadNow, meta } = data

  // Net revenue is a small difference between two large numbers, so it is worth
  // saying out loud how sensitive it is rather than printing it to the dollar.
  const amp =
    latest && latest.sllNet !== 0 ? Math.abs(latest.sllGross / latest.sllNet) : null

  const cards = latest
    ? [
        {
          label: "Gross yield",
          value: formatUSD(latest.sllGross + (latest.products?.SparkLend?.gross ?? 0)),
          sub: "what the capital earned",
          color: "#22c55e",
        },
        {
          label: "Funding cost",
          value: formatUSD(-latest.sllCost),
          sub: "paid to Sky",
          color: "#ef4444",
        },
        {
          label: "Net revenue",
          value: formatUSD(latest.netTotal),
          sub: prior ? `${latest.netTotal >= prior.netTotal ? "up" : "down"} on ${monthLabel(prior.month).split(" ")[0]}` : "",
          color: "#3b82f6",
        },
        {
          label: "Current spread",
          value: spreadNow ? `${spreadNow.spreadPct.toFixed(3)}%` : "n/a",
          sub: spreadNow ? `on $${(spreadNow.totalAssetsUsd / 1e9).toFixed(2)}B` : "",
          color: "#a855f7",
        },
      ]
    : []

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Financials</h2>
        <div className="flex-1 h-px bg-card-border" />
        {latest && (
          <span className="text-[10px] text-text-muted">
            {monthLabel(latest.month)}
            {meta?.latestMonthIsPartial ? ", still accruing" : ""}
          </span>
        )}
      </div>

      {cards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="tui-card bg-card-bg border border-card-border rounded p-4 relative overflow-hidden"
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{ backgroundColor: card.color }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.1em] block mb-1 pl-2"
                style={{ color: card.color }}
              >
                {card.label}
              </span>
              <div className="flex items-baseline gap-2 pl-2">
                <span className="text-lg font-semibold text-text-primary tabular-nums">
                  {card.value}
                </span>
              </div>
              {card.sub && (
                <span className="text-[9px] text-text-muted mt-0.5 block pl-2">{card.sub}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* How Spark actually makes money, and how little room there is in it. */}
      {amp !== null && latest && (
        <div
          className="rounded p-4 text-xs leading-relaxed"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            color: "var(--text-secondary)",
          }}
        >
          Spark borrows from Sky and redeploys the money, keeping the difference. In{" "}
          {monthLabel(latest.month)} the Liquidity Layer earned{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {formatUSDFull(latest.sllGross)}
          </strong>{" "}
          and paid{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {formatUSDFull(latest.sllCost)}
          </strong>{" "}
          for the capital, leaving{" "}
          <strong style={{ color: latest.sllNet < 0 ? "var(--danger)" : "var(--success)" }}>
            {formatUSDFull(latest.sllNet)}
          </strong>
          . Net revenue is{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {((latest.sllNet / latest.sllGross) * 100).toFixed(1)}%
          </strong>{" "}
          of gross, so a 1% mismeasurement of either input moves it by roughly{" "}
          <strong style={{ color: "var(--text-primary)" }}>{amp.toFixed(0)}x</strong>. Treat the
          net figure as a range rather than a number: Spark, Blockworks Research and DefiLlama
          publish three different answers for the same months, and they disagree on the sign.
        </div>
      )}

      <RevenueByProduct monthly={monthly} partialMonth={meta?.latestMonthIsPartial} />

      <MarginChart monthly={monthly} />

      <SpreadChart daily={sllDaily} />

      <IncomeStatement monthly={monthly} partialMonth={meta?.latestMonthIsPartial} />

      <SourceComparison rows={sourceComparison} />
    </div>
  )
}
