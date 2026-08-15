"use client"

import { MetricCard } from "@/components/metric-card"
import { EcosystemTvlChart } from "@/components/ecosystem-tvl-chart"
import { PeerMarketShareRanked, SparkShareOverTime } from "@/components/peer-market-share"
import { PeerRevenueYoY } from "@/components/peer-revenue-yoy"
import { formatUSD } from "@/lib/utils"
import { useCachedFetch } from "@/lib/use-cached-fetch"

function SectionPlaceholder({ label }: { label: string }) {
  return (
    <div className="tui-panel h-[300px] flex items-center justify-center animate-pulse">
      <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted">
        Loading {label}…
      </div>
    </div>
  )
}

/**
 * Overview - the ecosystem-level story.
 * SparkLend-specific charts (per-asset supply / borrow / liquidity,
 * collateral concentration, wstETH loop, deposits Sankey) live on /markets.
 */
export default function HomePage() {
  const { data: ecoData, error: ecoError } = useCachedFetch<{
    daily: Array<{ date: number; savings: number; sparklend: number; sll: number; total: number }>
    current: { savings: number; sparklend: number; sll: number; total: number }
  }>("/api/ecosystem", { ttl: 15 * 60_000 })
  const { data: peersData } = useCachedFetch<{
    daily: Array<Record<string, number>>
    current: Array<{ slug: string; name: string; isSpark: boolean; borrow: number; share: number }>
    currentTotal: number
    currentSparkShare: number
  }>("/api/peers", { ttl: 15 * 60_000 })
  const { data: peerRevData } = useCachedFetch<{
    peers: Array<{ slug: string; name: string; isSpark: boolean; recent90d: number; prior90d: number; yoyPct: number | null }>
    sll: { name: string; recent90d: number; prior90d: number; yoyPct: number | null }
    window: { days: number }
  }>("/api/peer-revenue", { ttl: 15 * 60_000 })

  // Always render the shell — never gate on a full-page LoadingSkeleton.
  // Every previous "iframe blank" incident was the skeleton locking on
  // because one or more fetches hung forever. Each section below shows
  // its own inline placeholder until its data arrives, so a hung fetch
  // can never nuke the whole page.
  const eco = ecoData?.current

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Overview Section Label */}
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Overview</h2>
          <div className="flex-1 h-px bg-card-border" />
        </div>

        {/* Ecosystem metric cards — only render when the ecosystem fetch landed. */}
        {eco && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricCard
              label="Spark Ecosystem TVL"
              value={eco.total}
              change24h={0}
              accentColor="#22c55e"
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              }
            />
            <MetricCard
              label="SparkLend Supply"
              value={eco.sparklend}
              change24h={0}
              accentColor="#3b82f6"
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              }
            />
            <MetricCard
              label="Spark Liquidity Layer"
              value={eco.sll}
              change24h={0}
              accentColor="#FF6B35"
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
          </div>
        )}

        {/* If ecosystem specifically failed, surface it so the page doesn't look silently broken. */}
        {ecoError && !ecoData && (
          <div className="tui-panel px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-xs text-text-secondary">
              Ecosystem TVL couldn't load ({ecoError}). Competitive positioning still shown below.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-[10px] uppercase tracking-[0.05em] px-2 py-1 border border-card-border hover:bg-card-hover transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Hero: Spark Ecosystem TVL (3 product lines). Inline placeholder
            while loading so the page isn't a dark void. */}
        {ecoData?.daily && ecoData.daily.length > 0 ? (
          <EcosystemTvlChart daily={ecoData.daily} current={ecoData.current} />
        ) : !ecoError ? (
          <SectionPlaceholder label="Ecosystem TVL" />
        ) : null}

        {/* Section divider */}
        <div className="tui-divider-labeled">
          <span className="tui-divider-label">Competitive Positioning</span>
        </div>

        {/* Peer market share: ranked bar + share over time */}
        {peersData?.current && peersData.daily ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PeerMarketShareRanked peers={peersData} />
            <SparkShareOverTime peers={peersData} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionPlaceholder label="Market Share Ranked" />
            <SectionPlaceholder label="Spark Share Over Time" />
          </div>
        )}

        {/* Peer revenue YoY - "Spark growing while peers shrink" */}
        {peerRevData?.peers ? (
          <PeerRevenueYoY peers={peerRevData.peers} sll={peerRevData.sll} window={peerRevData.window} />
        ) : (
          <SectionPlaceholder label="Peer Interest Income YoY" />
        )}
      </main>
    </div>
  )
}
