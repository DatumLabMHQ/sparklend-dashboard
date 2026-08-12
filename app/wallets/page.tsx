"use client"

import { useState, useMemo, useCallback } from "react"
import { WalletExplorer } from "@/components/wallets/wallet-explorer"
import { WalletTable } from "@/components/wallets/wallet-table"
import { WhaleConcentration } from "@/components/whale-concentration"
import { useCachedFetch } from "@/lib/use-cached-fetch"
import { formatUSD } from "@/lib/utils"

interface WalletPosition {
  address: string
  totalCollateral: number
  totalDebt: number
  healthFactor: number
  collateralAssets: string[]
  borrowAssets: string[]
}

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-24 bg-card-bg rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-card-bg border border-card-border rounded-lg" />
        ))}
      </div>
      <div className="h-40 bg-card-bg border border-card-border rounded-lg" />
      <div className="bg-card-bg border border-card-border rounded-lg">
        <div className="h-10 border-b border-card-border" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-card-border/50" />
        ))}
      </div>
    </div>
  )
}

export default function WalletsPage() {
  const { data: rawResponse, loading, error } = useCachedFetch<any>("/api/wallets?page=1&pageSize=5000", { ttl: 10 * 60_000 })
  const data: WalletPosition[] = rawResponse?.positions || []
  const totalDiscovered = rawResponse?.totalDiscovered || 0
  const totalActive = rawResponse?.totalActive || 0
  const totalCollateral = rawResponse?.totalCollateral || 0
  const totalDebt = rawResponse?.totalDebt || 0
  const scanComplete = rawResponse?.scanComplete ?? true

  // Filter state
  const [search, setSearch] = useState("")
  const [collateralFilter, setCollateralFilter] = useState<string[]>([])
  const [borrowFilter, setBorrowFilter] = useState<string[]>([])
  const [collateralMin, setCollateralMin] = useState("")
  const [collateralMax, setCollateralMax] = useState("")
  const [borrowMin, setBorrowMin] = useState("")
  const [borrowMax, setBorrowMax] = useState("")
  const [hfMin, setHfMin] = useState("")
  const [hfMax, setHfMax] = useState("")

  // Derive all unique assets
  const allAssets = useMemo(() => {
    const set = new Set<string>()
    data.forEach((w) => {
      w.collateralAssets.forEach((a) => set.add(a))
      w.borrowAssets.forEach((a) => set.add(a))
    })
    return Array.from(set).sort()
  }, [data])

  // Apply filters
  const filtered = useMemo(() => {
    return data.filter((w) => {
      if (search && !w.address.toLowerCase().includes(search.toLowerCase()))
        return false
      if (
        collateralFilter.length > 0 &&
        !collateralFilter.some((f) => w.collateralAssets.includes(f))
      )
        return false
      if (
        borrowFilter.length > 0 &&
        !borrowFilter.some((f) => w.borrowAssets.includes(f))
      )
        return false

      const cMin = parseFloat(collateralMin)
      const cMax = parseFloat(collateralMax)
      if (!isNaN(cMin) && w.totalCollateral < cMin) return false
      if (!isNaN(cMax) && w.totalCollateral > cMax) return false

      const bMin = parseFloat(borrowMin)
      const bMax = parseFloat(borrowMax)
      if (!isNaN(bMin) && w.totalDebt < bMin) return false
      if (!isNaN(bMax) && w.totalDebt > bMax) return false

      const hMin = parseFloat(hfMin)
      const hMax = parseFloat(hfMax)
      const hf = isFinite(w.healthFactor) ? w.healthFactor : 999999
      if (!isNaN(hMin) && hf < hMin) return false
      if (!isNaN(hMax) && hf > hMax) return false

      return true
    })
  }, [
    data, search, collateralFilter, borrowFilter,
    collateralMin, collateralMax, borrowMin, borrowMax,
    hfMin, hfMax,
  ])

  // Health factor distribution
  const hfDistribution = useMemo(() => {
    let safe = 0, moderate = 0, risky = 0, liquidatable = 0
    data.forEach((w) => {
      if (w.totalDebt <= 0) return // no debt = safe
      const hf = isFinite(w.healthFactor) ? w.healthFactor : 999
      if (hf < 1) liquidatable++
      else if (hf < 1.5) risky++
      else if (hf < 2) moderate++
      else safe++
    })
    return { safe, moderate, risky, liquidatable }
  }, [data])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="text-center py-12">
          <p className="text-danger text-sm">{error}</p>
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

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">
          Wallets
        </h2>
        <div className="flex-1 h-px bg-card-border" />
        {!scanComplete && (
          <span className="text-[10px] text-accent animate-pulse">
            Scanning for more wallets...
          </span>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Wallets</p>
          <p className="text-lg font-semibold text-text-primary">{totalActive.toLocaleString()}</p>
          <p className="text-[10px] text-text-muted mt-0.5">{totalDiscovered.toLocaleString()} discovered</p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Collateral</p>
          <p className="text-lg font-semibold text-text-primary">{formatUSD(totalCollateral)}</p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Debt</p>
          <p className="text-lg font-semibold text-text-primary">{formatUSD(totalDebt)}</p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Health Distribution</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-[10px] text-text-secondary">{hfDistribution.safe}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#FF6B35" }} />
              <span className="text-[10px] text-text-secondary">{hfDistribution.moderate}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f97316" }} />
              <span className="text-[10px] text-text-secondary">{hfDistribution.risky}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="text-[10px] text-text-secondary">{hfDistribution.liquidatable}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[9px] text-text-muted">Safe · Moderate · Risky · Liq.</span>
          </div>
        </div>
      </div>

      {/* Whale concentration — top-10 borrowers as % of protocol debt */}
      {data.length > 0 && <WhaleConcentration positions={data} totalDebt={totalDebt} />}

      <WalletExplorer
        allAssets={allAssets}
        search={search}
        onSearchChange={setSearch}
        collateralFilter={collateralFilter}
        onCollateralFilterChange={setCollateralFilter}
        borrowFilter={borrowFilter}
        onBorrowFilterChange={setBorrowFilter}
        collateralMin={collateralMin}
        collateralMax={collateralMax}
        onCollateralMinChange={setCollateralMin}
        onCollateralMaxChange={setCollateralMax}
        borrowMin={borrowMin}
        borrowMax={borrowMax}
        onBorrowMinChange={setBorrowMin}
        onBorrowMaxChange={setBorrowMax}
        hfMin={hfMin}
        hfMax={hfMax}
        onHfMinChange={setHfMin}
        onHfMaxChange={setHfMax}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {filtered.length} wallet{filtered.length !== 1 ? "s" : ""} shown
        </span>
      </div>

      <WalletTable data={filtered} />
    </div>
  )
}
