"use client"

import { MarketsTable } from "@/components/markets/markets-table"
import { useCachedFetch } from "@/lib/use-cached-fetch"

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-5 w-24 bg-card-bg rounded" />
      <div className="bg-card-bg border border-card-border rounded-lg">
        <div className="h-10 border-b border-card-border" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-card-border/50" />
        ))}
      </div>
    </div>
  )
}

export default function MarketsPage() {
  const { data: rawData, loading, error } = useCachedFetch("/api/markets", { ttl: 2 * 60_000 })
  const data = rawData || []

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
          Markets
        </h2>
        <div className="flex-1 h-px bg-card-border" />
      </div>
      <MarketsTable data={data} />
    </div>
  )
}
