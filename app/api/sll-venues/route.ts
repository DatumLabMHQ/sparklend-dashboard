import { NextResponse } from "next/server"

/**
 * SLL deployment breakdown by venue. Fetches DefiLlama's spark-liquidity-layer
 * per-token USD balances on Ethereum and categorises each token into a venue
 * category (Direct stablecoins, Spark Vault V2, Morpho, Aave V3, Yield tokens).
 *
 * Key finding vs Q2 2026 report: the report described SLL as deploying into
 * Morpho vaults, Aave V3, and Ethena sUSDe. Live shows the majority of the
 * balance sheet has migrated into Spark's OWN Vault V2 products (spDAI,
 * spUSDS, spUSDT, spPYUSD) — a real narrative shift worth surfacing.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 30

// Token symbol → { category, human-readable label }.
// Symbols are what DefiLlama reports; we map them to the venue they represent.
const TOKEN_CATEGORIES: Record<string, { category: string; label: string }> = {
  // Direct stablecoin holdings — idle capital waiting to be deployed
  USDS: { category: "Direct stablecoins", label: "USDS (idle)" },
  USDC: { category: "Direct stablecoins", label: "USDC (idle)" },
  USDT: { category: "Direct stablecoins", label: "USDT (idle)" },
  PYUSD: { category: "Direct stablecoins", label: "PYUSD (idle)" },
  DAI: { category: "Direct stablecoins", label: "DAI (idle)" },
  SUSDS: { category: "Direct stablecoins", label: "sUSDS (savings)" },
  // Spark Vault V2 — Spark's own vault product; SLL deposits into these
  SPUSDS: { category: "Spark Vault V2", label: "spUSDS vault" },
  SPUSDT: { category: "Spark Vault V2", label: "spUSDT vault" },
  SPDAI: { category: "Spark Vault V2", label: "spDAI vault" },
  SPPYUSD: { category: "Spark Vault V2", label: "spPYUSD vault" },
  SPUSDC: { category: "Spark Vault V2", label: "spUSDC vault" },
  SPETH: { category: "Spark Vault V2", label: "spETH vault" },
  // Morpho Blue vaults curated for Spark (Base Chain variants)
  SPARKUSDCBC: { category: "Morpho Blue", label: "Morpho USDC (Base variant)" },
  SPARKUSDTBC: { category: "Morpho Blue", label: "Morpho USDT (Base variant)" },
  SPARKUSDS: { category: "Morpho Blue", label: "Morpho USDS" },
  // Aave V3 positions (aTokens on Ethereum)
  AETHUSDT: { category: "Aave V3", label: "Aave V3 USDT" },
  AETHUSDC: { category: "Aave V3", label: "Aave V3 USDC" },
  AETHUSDS: { category: "Aave V3", label: "Aave V3 USDS" },
  AETHLIDOUSDS: { category: "Aave V3", label: "Aave Prime USDS" },
  // Yield / RWA-adjacent tokens Spark holds
  SUSDE: { category: "Yield tokens", label: "Ethena sUSDe" },
  USDE: { category: "Yield tokens", label: "Ethena USDe" },
  SYRUPUSDC: { category: "Yield tokens", label: "Maple syrupUSDC" },
  USTB: { category: "Yield tokens", label: "Superstate USTB (RWA)" },
}

// Category → colour (Spark-orange for the "own vault" category to signal it's Spark's product).
const CATEGORY_COLORS: Record<string, string> = {
  "Spark Vault V2": "#FF6B35",
  "Morpho Blue": "#5B7FFF",
  "Aave V3": "#B4C5EA",
  "Yield tokens": "#A78BFA",
  "Direct stablecoins": "#22c55e",
  Other: "#6B7280",
}

let cache: any = null
let cacheTime = 0
const TTL = 30 * 60_000

export async function GET() {
  if (cache && Date.now() - cacheTime < TTL) {
    return NextResponse.json(cache)
  }

  try {
    const r = await fetch("https://api.llama.fi/protocol/spark-liquidity-layer", {
      cache: "no-store",
    })
    if (!r.ok) throw new Error(`defillama ${r.status}`)
    const j = await r.json()

    const eth = j.chainTvls?.Ethereum
    const latest = eth?.tokensInUsd?.at(-1)
    if (!latest?.tokens) throw new Error("no token data")

    interface TokenEntry {
      symbol: string
      label: string
      category: string
      usd: number
    }

    const entries: TokenEntry[] = []
    let totalUsd = 0
    for (const [rawSymbol, rawValue] of Object.entries(latest.tokens)) {
      const usd = rawValue as number
      if (!Number.isFinite(usd) || usd < 100) continue // filter dust
      const symbol = rawSymbol.toUpperCase()
      const meta = TOKEN_CATEGORIES[symbol] || { category: "Other", label: symbol }
      entries.push({ symbol, label: meta.label, category: meta.category, usd })
      totalUsd += usd
    }

    entries.sort((a, b) => b.usd - a.usd)

    // Roll up by category
    const byCategory: Record<string, { category: string; usd: number; share: number; color: string }> = {}
    for (const e of entries) {
      if (!byCategory[e.category]) {
        byCategory[e.category] = {
          category: e.category,
          usd: 0,
          share: 0,
          color: CATEGORY_COLORS[e.category] || "#6B7280",
        }
      }
      byCategory[e.category].usd += e.usd
    }
    for (const c of Object.values(byCategory)) {
      c.share = totalUsd > 0 ? (c.usd / totalUsd) * 100 : 0
    }
    const categories = Object.values(byCategory).sort((a, b) => b.usd - a.usd)

    // Enrich per-token entries with share
    const positions = entries.map((e) => ({
      ...e,
      share: totalUsd > 0 ? (e.usd / totalUsd) * 100 : 0,
      color: CATEGORY_COLORS[e.category] || "#6B7280",
    }))

    const result = {
      totalUsd,
      asOf: latest.date,
      categories,
      positions,
      meta: {
        source: "DefiLlama /protocol/spark-liquidity-layer Ethereum tokensInUsd",
        note:
          "Q2 2026 report described SLL as deploying into Morpho vaults, Aave V3, and Ethena sUSDe. Live composition shows a shift toward Spark's own Vault V2 products (spUSDS/spDAI/spUSDT/spPYUSD) — Spark now largely self-curates its capital rather than outsourcing to external venues.",
      },
    }

    cache = result
    cacheTime = Date.now()

    const res = NextResponse.json(result)
    res.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600")
    return res
  } catch (err: any) {
    console.error("SLL venues API error:", err.message?.slice(0, 100))
    if (cache) return NextResponse.json(cache)
    return NextResponse.json(
      { error: "Failed to fetch SLL venue data", details: err.message },
      { status: 500 }
    )
  }
}
