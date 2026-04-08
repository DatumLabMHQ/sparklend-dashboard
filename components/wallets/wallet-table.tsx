"use client"

import { useState, useMemo } from "react"
import { formatUSD } from "@/lib/utils"
import { TokenIcon } from "@/components/token-icon"

interface WalletPosition {
  address: string
  totalCollateral: number
  totalDebt: number
  healthFactor: number
  collateralAssets: string[]
  borrowAssets: string[]
}

type SortKey = "address" | "totalCollateral" | "totalDebt" | "healthFactor"

function SortIcon({
  active,
  direction,
}: {
  active: boolean
  direction: "asc" | "desc"
}) {
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

function AssetBadges({ assets }: { assets: string[] }) {
  const shown = assets.slice(0, 3)
  const extra = assets.length - 3

  return (
    <div className="flex items-center gap-1">
      {shown.map((sym) => (
        <TokenIcon key={sym} symbol={sym} size={24} />
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-text-muted ml-0.5">+{extra}</span>
      )}
    </div>
  )
}

function formatHF(hf: number | null | undefined): string {
  if (hf == null || !isFinite(hf) || hf > 1000) return "\u221E"
  return hf.toFixed(2)
}

function hfColor(hf: number | null | undefined): string {
  if (hf == null || !isFinite(hf) || hf > 1000) return "text-success"
  if (hf >= 2) return "text-success"
  if (hf >= 1.5) return "text-accent"
  return "text-danger"
}

export function WalletTable({ data }: { data: WalletPosition[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCollateral")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
    setPage(1)
  }

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      let cmp = 0
      if (sortKey === "address") {
        cmp = a.address.localeCompare(b.address)
      } else if (sortKey === "healthFactor") {
        const aHf = a.healthFactor != null && isFinite(a.healthFactor) ? a.healthFactor : 999999
        const bHf = b.healthFactor != null && isFinite(b.healthFactor) ? b.healthFactor : 999999
        cmp = aHf - bHf
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginatedData = sorted.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              <th
                onClick={() => toggleSort("address")}
                className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none text-left"
              >
                <span className="inline-flex items-center gap-1">
                  Wallet Address
                  <SortIcon active={sortKey === "address"} direction={sortDir} />
                </span>
              </th>
              <th
                onClick={() => toggleSort("totalCollateral")}
                className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none text-right"
              >
                <span className="inline-flex items-center gap-1">
                  Collateral
                  <SortIcon active={sortKey === "totalCollateral"} direction={sortDir} />
                </span>
              </th>
              <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">
                Collateral Assets
              </th>
              <th
                onClick={() => toggleSort("totalDebt")}
                className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none text-right"
              >
                <span className="inline-flex items-center gap-1">
                  Borrow
                  <SortIcon active={sortKey === "totalDebt"} direction={sortDir} />
                </span>
              </th>
              <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">
                Borrow Assets
              </th>
              <th
                onClick={() => toggleSort("healthFactor")}
                className="px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none text-right"
              >
                <span className="inline-flex items-center gap-1">
                  Health Factor
                  <SortIcon active={sortKey === "healthFactor"} direction={sortDir} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row) => (
              <tr
                key={row.address}
                className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors"
              >
                <td className="px-4 py-3.5 text-sm text-text-secondary font-mono">
                  <a
                    href={`https://etherscan.io/address/${row.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent transition-colors"
                  >
                    {row.address.slice(0, 6)}...{row.address.slice(-4)}
                  </a>
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-text-primary">
                  {formatUSD(row.totalCollateral)}
                </td>
                <td className="px-4 py-3.5">
                  <AssetBadges assets={row.collateralAssets} />
                </td>
                <td className="px-4 py-3.5 text-right text-sm text-text-primary">
                  {formatUSD(row.totalDebt)}
                </td>
                <td className="px-4 py-3.5">
                  <AssetBadges assets={row.borrowAssets} />
                </td>
                <td className={`px-4 py-3.5 text-right text-sm font-medium ${hfColor(row.healthFactor)}`}>
                  {formatHF(row.healthFactor)}
                </td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted text-sm">
                  No wallets match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="border-t border-card-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1) }}
              className="bg-background border border-card-border rounded px-2 py-1 text-xs text-text-secondary outline-none"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
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
        </div>
      )}
    </div>
  )
}
