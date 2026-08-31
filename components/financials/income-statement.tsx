"use client"

import { useState } from "react"
import { formatUSDFull } from "@/lib/utils"
import { ChartFrame } from "@/components/chart-frame"

interface MonthRow {
  month: string
  products: Record<string, { gross: number; net: number }>
  grossTotal: number
  netTotal: number
  sllGross: number
  sllNet: number
  sllCost: number
}

function label(m: string) {
  const [y, mm] = m.split("-")
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mm - 1]} '${y.slice(2)}`
}

const P = (r: MonthRow, k: string, f: "gross" | "net") => r.products[k]?.[f] ?? 0

/**
 * Spark's income statement, first-party, monthly.
 *
 * Laid out as line items down and periods across, the way an income statement
 * is normally read. Cost is shown as its own line rather than folded into a net
 * figure, because net is a thin residual of two much larger numbers and hiding
 * the inputs is what makes the residual look more precise than it is.
 */
export function IncomeStatement({ monthly, partialMonth }: { monthly: MonthRow[]; partialMonth?: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const cols = showAll ? [...monthly].reverse() : [...monthly].reverse().slice(0, 6)

  const rows: Array<{ key: string; label: string; get: (r: MonthRow) => number; kind?: "cost" | "sub" | "total" | "head" }> = [
    { key: "sllg", label: "Liquidity Layer gross yield", get: (r) => r.sllGross },
    { key: "sllc", label: "Liquidity Layer funding cost", get: (r) => -r.sllCost, kind: "cost" },
    { key: "slln", label: "Liquidity Layer net", get: (r) => r.sllNet, kind: "sub" },
    { key: "sl", label: "SparkLend", get: (r) => P(r, "SparkLend", "net") },
    { key: "dr", label: "Distribution Rewards", get: (r) => P(r, "Distribution Rewards", "net") },
    { key: "cf", label: "Curation Fees", get: (r) => P(r, "Curation Fees", "net") },
    { key: "tot", label: "Net revenue", get: (r) => r.netTotal, kind: "total" },
  ]

  return (
    <ChartFrame
      title="Income statement"
      subtitle="Spark's own monthly accounting, by product"
      source="data.spark.finance (Block Analitica)"
      height={0}
      methodology={
        <>
          Spark&apos;s published financials, monthly, from
          <code> /v1/financials/categories/historic/</code>. Gross yield is what the deployed
          capital earned; funding cost is what Spark paid Sky for it. Net revenue is the
          difference, and it is small relative to both inputs, so it moves sharply on small
          changes to either. Blockworks Research agrees with this source on gross yield to
          within 1% and on Distribution Rewards to within 1%, and books a 2% to 6% lower
          funding cost, which is enough to change the sign of net in some quarters.
        </>
      }
      footnote={
        partialMonth ? (
          <>The most recent month is still accruing. Distribution Rewards settle as a monthly
          off-chain rebate and lag, so the latest column should be expected to revise upward.</>
        ) : undefined
      }
      actions={
        monthly.length > 6 ? (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
            style={{ color: "var(--text-muted)", border: "1px solid var(--card-border)" }}
          >
            {showAll ? "Last 6" : `All ${monthly.length}`}
          </button>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium py-2 pr-4 sticky left-0 z-10"
                  style={{ color: "var(--text-muted)", background: "var(--card-bg)" }} />
              {cols.map((c) => (
                <th key={c.month} className="text-right font-medium py-2 px-3 whitespace-nowrap"
                    style={{ color: "var(--text-muted)" }}>
                  {label(c.month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isTotal = row.kind === "total"
              const isSub = row.kind === "sub"
              return (
                <tr key={row.key}
                    style={{ borderTop: isTotal || isSub ? "1px solid var(--card-border)" : undefined }}>
                  <td className="text-left py-1.5 pr-4 whitespace-nowrap sticky left-0 z-10"
                      style={{
                        color: isTotal ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: isTotal ? 600 : 400,
                        background: "var(--card-bg)",
                        paddingLeft: row.kind === "cost" || isSub ? 12 : 0,
                      }}>
                    {row.label}
                  </td>
                  {cols.map((c) => {
                    const v = row.get(c)
                    return (
                      <td key={c.month} className="text-right py-1.5 px-3 tabular-nums whitespace-nowrap"
                          style={{
                            color:
                              v < 0 ? "var(--danger)"
                              : isTotal ? "var(--text-primary)"
                              : "var(--text-secondary)",
                            fontWeight: isTotal || isSub ? 600 : 400,
                          }}>
                        {formatUSDFull(v)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  )
}
