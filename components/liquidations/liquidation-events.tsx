"use client"

import { useState, useMemo } from "react"
import { formatUSD } from "@/lib/utils"
import { TokenIcon } from "@/components/token-icon"

interface LiquidationEvent {
  date: string
  timestamp: number
  collateralAsset: string
  debtAsset: string
  borrower: string
  liquidator: string
  collateralSeizedUSD: number
  debtRepaidUSD: number
  txHash: string
}

type SortKey = "timestamp" | "collateralSeizedUSD" | "debtRepaidUSD"

export function LiquidationEvents({ events, allAssets }: { events: LiquidationEvent[]; allAssets: string[] }) {
  const [collateralFilter, setCollateralFilter] = useState("")
  const [debtFilter, setDebtFilter] = useState("")
  const [borrowerSearch, setBorrowerSearch] = useState("")
  const [liquidatorSearch, setLiquidatorSearch] = useState("")
  const [minDebt, setMinDebt] = useState("")
  const [maxDebt, setMaxDebt] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("timestamp")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [showUSD, setShowUSD] = useState(true)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (collateralFilter && e.collateralAsset !== collateralFilter) return false
      if (debtFilter && e.debtAsset !== debtFilter) return false
      if (borrowerSearch && !e.borrower.includes(borrowerSearch.toLowerCase())) return false
      if (liquidatorSearch && !e.liquidator.includes(liquidatorSearch.toLowerCase())) return false
      const mn = parseFloat(minDebt)
      const mx = parseFloat(maxDebt)
      if (!isNaN(mn) && e.debtRepaidUSD < mn) return false
      if (!isNaN(mx) && e.debtRepaidUSD > mx) return false
      return true
    }).sort((a, b) => {
      const cmp = (a[sortKey] as number) - (b[sortKey] as number)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [events, collateralFilter, debtFilter, borrowerSearch, liquidatorSearch, minDebt, maxDebt, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const clearFilters = () => {
    setCollateralFilter("")
    setDebtFilter("")
    setBorrowerSearch("")
    setLiquidatorSearch("")
    setMinDebt("")
    setMaxDebt("")
  }

  const exportCSV = () => {
    const header = "Date,Collateral Asset,Debt Asset,Borrower,Debt Repaid,Collateral Seized,Tx Hash,Liquidator"
    const rows = filtered.map((e) =>
      `${e.date},${e.collateralAsset},${e.debtAsset},${e.borrower},${e.debtRepaidUSD.toFixed(2)},${e.collateralSeizedUSD.toFixed(2)},${e.txHash},${e.liquidator}`
    )
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "sparklend-liquidations.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Liquidation Events</h3>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Collateral Asset</label>
          <select value={collateralFilter} onChange={(e) => setCollateralFilter(e.target.value)} className="w-full bg-background border border-card-border rounded-md px-2 py-1.5 text-xs text-text-secondary outline-none">
            <option value="">All assets</option>
            {allAssets.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Debt Asset</label>
          <select value={debtFilter} onChange={(e) => setDebtFilter(e.target.value)} className="w-full bg-background border border-card-border rounded-md px-2 py-1.5 text-xs text-text-secondary outline-none">
            <option value="">All assets</option>
            {allAssets.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Borrower Address</label>
          <input type="text" placeholder="Search borrower..." value={borrowerSearch} onChange={(e) => setBorrowerSearch(e.target.value)} className="w-full bg-background border border-card-border rounded-md px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted" />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Liquidator Address</label>
          <input type="text" placeholder="Search liquidator..." value={liquidatorSearch} onChange={(e) => setLiquidatorSearch(e.target.value)} className="w-full bg-background border border-card-border rounded-md px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Min Debt Repaid ($)</label>
          <input type="text" placeholder="0" value={minDebt} onChange={(e) => setMinDebt(e.target.value)} className="w-full bg-background border border-card-border rounded-md px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted" />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1">Max Debt Repaid ($)</label>
          <input type="text" placeholder="∞" value={maxDebt} onChange={(e) => setMaxDebt(e.target.value)} className="w-full bg-background border border-card-border rounded-md px-2 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={clearFilters} className="px-3 py-1.5 text-xs border border-card-border rounded-md text-text-muted hover:text-text-secondary transition-colors">Clear</button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input type="checkbox" checked={showUSD} onChange={(e) => setShowUSD(e.target.checked)} className="accent-accent" />
            Show USD amounts
          </label>
          <button onClick={exportCSV} className="px-3 py-1.5 text-xs border border-card-border rounded-md text-text-secondary hover:text-text-primary transition-colors">Export to CSV</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              <th onClick={() => toggleSort("timestamp")} className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left cursor-pointer hover:text-text-secondary">Date</th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">Collateral</th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">Debt</th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">Borrower</th>
              <th onClick={() => toggleSort("debtRepaidUSD")} className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-right cursor-pointer hover:text-text-secondary">Debt Repaid</th>
              <th onClick={() => toggleSort("collateralSeizedUSD")} className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-right cursor-pointer hover:text-text-secondary">Collateral Seized</th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">Tx Hash</th>
              <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-muted text-left">Liquidator</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(page * pageSize, (page + 1) * pageSize).map((e, i) => (
              <tr key={`${e.txHash}-${i}`} className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors">
                <td className="px-3 py-2.5 text-xs text-text-secondary whitespace-nowrap">
                  {new Date(e.timestamp * 1000).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}
                  <br />
                  <span className="text-text-muted text-[10px]">{new Date(e.timestamp * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                </td>
                <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><TokenIcon symbol={e.collateralAsset} size={18} /><span className="text-xs text-text-primary">{e.collateralAsset}</span></div></td>
                <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><TokenIcon symbol={e.debtAsset} size={18} /><span className="text-xs text-text-primary">{e.debtAsset}</span></div></td>
                <td className="px-3 py-2.5 text-xs text-text-secondary font-mono">{e.borrower.slice(0, 6)}...{e.borrower.slice(-4)}</td>
                <td className="px-3 py-2.5 text-xs text-text-primary text-right">{showUSD ? formatUSD(e.debtRepaidUSD) : e.debtRepaidUSD.toFixed(4)}</td>
                <td className="px-3 py-2.5 text-xs text-text-primary text-right">{showUSD ? formatUSD(e.collateralSeizedUSD) : e.collateralSeizedUSD.toFixed(4)}</td>
                <td className="px-3 py-2.5 text-xs font-mono"><a href={`https://etherscan.io/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{e.txHash.slice(0, 8)}...{e.txHash.slice(-4)}</a></td>
                <td className="px-3 py-2.5 text-xs text-text-secondary font-mono">{e.liquidator.slice(0, 6)}...{e.liquidator.slice(-4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-xs text-text-muted">No liquidation events match your filters</p>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
              className="bg-background border border-card-border rounded-md px-2 py-1 text-xs text-text-secondary outline-none"
            >
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 text-xs border border-card-border rounded-md text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-text-muted px-2">
              Page {page + 1} of {Math.ceil(filtered.length / pageSize)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / pageSize) - 1, p + 1))}
              disabled={(page + 1) * pageSize >= filtered.length}
              className="px-2.5 py-1 text-xs border border-card-border rounded-md text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
