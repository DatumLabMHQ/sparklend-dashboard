"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatUSD, formatPercent, getTokenName } from "@/lib/utils"
import { TokenIcon } from "@/components/token-icon"

interface MarketRow {
  symbol: string
  address: string
  price: number
  totalSupply: number
  totalBorrow: number
  supplyAPY: number
  borrowAPY: number
  utilization: number
}

type SortKey = "symbol" | "price" | "totalSupply" | "totalBorrow" | "supplyAPY" | "borrowAPY" | "utilization"

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted/40">
        <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
      {direction === "asc" ? <path d="M7 15l5 5 5-5" /> : <path d="M7 9l5-5 5 5" />}
    </svg>
  )
}

export function MarketsTable({ data }: { data: MarketRow[] }) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>("totalSupply")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === "symbol") {
      cmp = a.symbol.localeCompare(b.symbol)
    } else {
      cmp = (a[sortKey] as number) - (b[sortKey] as number)
    }
    return sortDir === "asc" ? cmp : -cmp
  })

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "symbol", label: "Asset" },
    { key: "price", label: "Price", align: "right" },
    { key: "totalSupply", label: "Total Supply", align: "right" },
    { key: "totalBorrow", label: "Total Borrow", align: "right" },
    { key: "supplyAPY", label: "Supply APY", align: "right" },
    { key: "borrowAPY", label: "Borrow APY", align: "right" },
    { key: "utilization", label: "Utilization", align: "right" },
  ]

  return (
    <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon active={sortKey === col.key} direction={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.symbol}
                onClick={() => router.push(`/markets/${row.symbol.toLowerCase()}`)}
                className="border-b border-card-border/50 hover:bg-card-border/20 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <TokenIcon symbol={row.symbol} size={28} />
                    <span className="text-sm font-medium text-text-primary">
                      {getTokenName(row.symbol)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-text-primary">
                  {row.price >= 1
                    ? `$${row.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${row.price.toFixed(4)}`}
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-text-primary">
                  {formatUSD(row.totalSupply)}
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-text-primary">
                  {formatUSD(row.totalBorrow)}
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-success">
                  {formatPercent(row.supplyAPY)}
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-accent">
                  {formatPercent(row.borrowAPY)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-secondary"
                        style={{ width: `${Math.min(row.utilization, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-secondary w-12 text-right">
                      {formatPercent(row.utilization)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
