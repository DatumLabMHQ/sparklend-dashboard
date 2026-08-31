"use client"

import { formatUSDFull } from "@/lib/utils"
import { ChartFrame } from "@/components/chart-frame"

interface Row {
  month: string
  sparkGross: number
  sparkNet: number
  llamaGross: number | null
  llamaNet: number | null
  llamaCapturePct: number | null
}

function label(m: string) {
  const [y, mm] = m.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[Number(mm) - 1]} '${y.slice(2)}`
}

/**
 * Published on purpose.
 *
 * DefiLlama reads the same Spark table this dashboard reads, but captures only
 * part of it, then nets a full month of funding cost against a partial month of
 * yield. The result is a reported loss at a product that made money. Showing the
 * gap is more useful to a reader than quietly using the better number.
 */
export function SourceComparison({ rows }: { rows: Row[] }) {
  const withBoth = rows.filter((r) => r.llamaGross !== null && r.sparkGross > 0)
  // Sign disagreements run in both directions: DefiLlama has shown a profit
  // where Spark books a loss as well as the reverse. Count either.
  const flips = withBoth.filter(
    (r) => r.sparkNet !== 0 && Math.sign(r.sparkNet) !== Math.sign(r.llamaNet ?? 0)
  ).length
  const worst = withBoth.reduce(
    (m, r) => ((r.llamaCapturePct ?? 100) < (m?.llamaCapturePct ?? 100) ? r : m),
    withBoth[0]
  )

  return (
    <ChartFrame
      title="Why this page does not use DefiLlama"
      subtitle="Liquidity Layer gross yield and net revenue, Spark's own books against DefiLlama"
      source="data.spark.finance vs api.llama.fi"
      height={0}
      methodology={
        <>
          DefiLlama&apos;s Spark Liquidity Layer adapter reads a Dune table published by Spark,
          one day at a time, and stores whatever it finds. Where the table is still filling in
          when it reads, the partial row set is kept. Verified against the source: several days
          match to the dollar while others are short by more than $100,000, and the served
          series swings around 50% day to day where the source moves under 5%. Netting a full
          day of funding cost against a partial day of yield turns a profit into a loss.
        </>
      }
      footnote={
        withBoth.length > 0 ? (
          <>
            Across {withBoth.length} months the two sources disagree on the{" "}
            <strong>sign</strong> of net revenue in <strong>{flips}</strong> of them.
            {worst ? (
              <>
                {" "}
                Capture is worst in {label(worst.month)} at{" "}
                <strong>{(worst.llamaCapturePct ?? 0).toFixed(1)}%</strong>.
              </>
            ) : null}{" "}
            The shortfall appears from May 2026 onward; earlier months track closely, which is
            consistent with a collection fault rather than a difference of definition. Reported
            to DefiLlama.
          </>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left font-medium py-2 pr-4">Month</th>
              <th className="text-right font-medium py-2 px-3">Gross, Spark</th>
              <th className="text-right font-medium py-2 px-3">Gross, DefiLlama</th>
              <th className="text-right font-medium py-2 px-3">Captured</th>
              <th className="text-right font-medium py-2 px-3">Net, Spark</th>
              <th className="text-right font-medium py-2 pl-3">Net, DefiLlama</th>
            </tr>
          </thead>
          <tbody>
            {withBoth.map((r) => {
              const flipped = r.sparkNet > 0 && (r.llamaNet ?? 0) < 0
              return (
                <tr key={r.month} style={{ borderTop: "1px solid var(--card-border)" }}>
                  <td
                    className="text-left py-1.5 pr-4 whitespace-nowrap"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {label(r.month)}
                  </td>
                  <td
                    className="text-right py-1.5 px-3 tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatUSDFull(r.sparkGross)}
                  </td>
                  <td
                    className="text-right py-1.5 px-3 tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatUSDFull(r.llamaGross ?? 0)}
                  </td>
                  <td
                    className="text-right py-1.5 px-3 tabular-nums"
                    style={{
                      color:
                        (r.llamaCapturePct ?? 100) < 90 ? "var(--warning)" : "var(--text-muted)",
                    }}
                  >
                    {(r.llamaCapturePct ?? 0).toFixed(1)}%
                  </td>
                  <td
                    className="text-right py-1.5 px-3 tabular-nums"
                    style={{ color: r.sparkNet < 0 ? "var(--danger)" : "var(--success)" }}
                  >
                    {formatUSDFull(r.sparkNet)}
                  </td>
                  <td
                    className="text-right py-1.5 pl-3 tabular-nums"
                    style={{
                      color: (r.llamaNet ?? 0) < 0 ? "var(--danger)" : "var(--text-muted)",
                      fontWeight: flipped ? 600 : 400,
                    }}
                  >
                    {formatUSDFull(r.llamaNet ?? 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  )
}
