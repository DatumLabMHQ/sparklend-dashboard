"use client"

import { useState, useMemo } from "react"
import { formatUSD, formatPercent } from "@/lib/utils"

interface LiquidationEvent {
  timestamp: number
  liquidator: string
  collateralSeizedUSD: number
  debtRepaidUSD: number
  profit: number
}

interface LiquidatorRow {
  address: string
  count: number
  totalCollateral: number
  totalDebt: number
  totalProfit: number
  profitShare: number
  lastActive: number
}

type SortKey = "count" | "totalCollateral" | "totalDebt" | "totalProfit" | "profitShare" | "lastActive"

export function LiquidatorTable({ events }: { events: LiquidationEvent[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalProfit")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { rows, summary } = useMemo(() => {
    const map = new Map<string, { count: number; totalCollateral: number; totalDebt: number; totalProfit: number; lastActive: number }>()

    for (const e of events) {
      const addr = e.liquidator
      const existing = map.get(addr) || { count: 0, totalCollateral: 0, totalDebt: 0, totalProfit: 0, lastActive: 0 }
      existing.count++
      existing.totalCollateral += e.collateralSeizedUSD
      existing.totalDebt += e.debtRepaidUSD
      existing.totalProfit += e.profit
      existing.lastActive = Math.max(existing.lastActive, e.timestamp)
      map.set(addr, existing)
    }

    const grandProfit = Array.from(map.values()).reduce((s, v) => s + v.totalProfit, 0)

    const rows: LiquidatorRow[] = Array.from(map.entries()).map(([address, data]) => ({
      address,
      ...data,
      profitShare: grandProfit > 0 ? (data.totalProfit / grandProfit) * 100 : 0,
    }))

    const summary = {
      totalLiquidators: rows.length,
      totalCollateral: rows.reduce((s, r) => s + r.totalCollateral, 0),
      totalDebt: rows.reduce((s, r) => s + r.totalDebt, 0),
      totalProfit: grandProfit,
    }

    return { rows, summary }
  }, [events])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
    setPage(1)
  }

  const sorted = [...rows].sort((a, b) => {
    const cmp = (a[sortKey] as number) - (b[sortKey] as number)
    return sortDir === "asc" ? cmp : -cmp
  })

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Liquidators", value: summary.totalLiquidators.toLocaleString() },
          { label: "Total Collateral Liquidated", value: formatUSD(summary.totalCollateral) },
          { label: "Total Debt Repaid", value: formatUSD(summary.totalDebt) },
          { label: "Est. Liquidator Profits", value: summary.totalProfit >= 0 ? formatUSD(summary.totalProfit) : `-${formatUSD(Math.abs(summary.totalProfit))}` },
        ].map((card) => (
          <div key={card.label} className="bg-card-bg border border-card-border rounded-lg p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted block mb-1">{card.label}</span>
            <span className="text-lg font-semibold text-text-primary">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">Liquidator</th>
                {([
                  ["count", "Liquidations"],
                  ["totalCollateral", "Total Collateral"],
                  ["totalDebt", "Total Debt Repaid"],
                  ["totalProfit", "Total Profits"],
                  ["profitShare", "% Share"],
                  ["lastActive", "Last Active"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} onClick={() => toggleSort(key)} className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted text-right cursor-pointer hover:text-text-secondary transition-colors select-none">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((row) => (
                <tr key={row.address} className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-text-secondary font-mono">
                    <a href={`https://etherscan.io/address/${row.address}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                      {row.address.slice(0, 6)}...{row.address.slice(-4)}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-primary text-right">{row.count}</td>
                  <td className="px-4 py-3 text-xs text-text-primary text-right">{formatUSD(row.totalCollateral)}</td>
                  <td className="px-4 py-3 text-xs text-text-primary text-right">{formatUSD(row.totalDebt)}</td>
                  <td className={`px-4 py-3 text-xs text-right font-medium ${row.totalProfit >= 0 ? "text-success" : "text-danger"}`}>{row.totalProfit >= 0 ? formatUSD(row.totalProfit) : `-${formatUSD(Math.abs(row.totalProfit))}`}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary text-right">{formatPercent(row.profitShare, 1)}</td>
                  <td className="px-4 py-3 text-xs text-text-muted text-right whitespace-nowrap">
                    {new Date(row.lastActive * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sorted.length > pageSize && (
          <div className="border-t border-card-border px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                &laquo;
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                &lsaquo;
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
