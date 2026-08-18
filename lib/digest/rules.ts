/**
 * Rule engine for the weekly digest. Each rule receives the fetched
 * upstream payloads and returns one or more Callouts. Callouts are
 * grouped into sections in compose.ts.
 *
 * Rule philosophy: prefer signals we could plausibly turn into a tweet.
 * Anything a Spark community member or Sam MacPherson would engage with.
 * Avoid noise: skip a callout entirely if the change is below a
 * meaningful threshold.
 */

export type Severity = "narrative" | "risk" | "info"

export interface Callout {
  section: "buyback" | "market_share" | "growth" | "risk" | "product"
  severity: Severity
  headline: string
  body: string
  metric?: { label: string; value: string; delta?: string }
  href?: string
}

export interface Snapshot {
  buybacks: any | null
  ecosystem: any | null
  peers: any | null
  peerRevenue: any | null
  financials: any | null
  spkToken: any | null
}

const formatUsd = (v: number, d = 1) =>
  v >= 1e9
    ? `$${(v / 1e9).toFixed(d)}B`
    : v >= 1e6
      ? `$${(v / 1e6).toFixed(d)}M`
      : v >= 1e3
        ? `$${(v / 1e3).toFixed(d)}K`
        : `$${v.toFixed(2)}`

const formatPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`

// Look up daily[-1] and daily[-8] on any series with { date, ...values }.
// Returns null if there aren't 8 days of history yet.
// Typed as `any` at the point of use because callers reach for
// series-specific keys (sparkShare, total, sparklend, ...) that the
// inbound API shape doesn't statically expose.
function weekAgo(
  series: any[] | undefined
): { latest: any; prior: any } | null {
  if (!series || series.length < 8) return null
  return { latest: series[series.length - 1], prior: series[series.length - 8] }
}

// ── Rules ────────────────────────────────────────────────────────────────────

/** Cushion above buyback threshold: callout if runway crosses key thresholds
 *  or moved meaningfully WoW. */
export function ruleBuybackCushion(s: Snapshot): Callout[] {
  const bb = s.buybacks
  if (!bb?.threshold) return []
  const { cushionUSD, cushionMonths, targetUSD, monthlyBudgetUSD } = bb.threshold
  const treasuryUSD = bb.treasury?.totalUSD || 0
  if (!(treasuryUSD > 0)) return []

  const callouts: Callout[] = []

  // Absolute snapshot always included so the digest reader knows where we are.
  callouts.push({
    section: "buyback",
    severity: "info",
    headline: `Treasury cushion: ${formatUsd(cushionUSD)} (${cushionMonths?.toFixed(1)}mo runway)`,
    body: `Spendable treasury sits at ${formatUsd(treasuryUSD)} vs a ${formatUsd(targetUSD)} buyback threshold. At the current ${formatUsd(monthlyBudgetUSD)} monthly TWAP budget, that is ${cushionMonths?.toFixed(1)} months of runway before Spark would need to pause buybacks.`,
    metric: { label: "Cushion", value: formatUsd(cushionUSD) },
    href: "https://www.datumlab.xyz/sparklend/spk-token",
  })

  // Warnings for low runway.
  if (cushionMonths != null && cushionMonths < 3) {
    callouts.push({
      section: "risk",
      severity: "risk",
      headline: `Buyback runway under 3 months (${cushionMonths.toFixed(1)}mo)`,
      body: `Cushion above the buyback threshold has fallen to ${formatUsd(cushionUSD)}. At the current TWAP pace this covers ${cushionMonths.toFixed(1)} months. Phoenix Labs may lower the buyback rate next cycle.`,
      href: "https://www.datumlab.xyz/sparklend/spk-token",
    })
  }
  return callouts
}

/** This week's on-chain buyback fills. Aggregated dollar spend + average price
 *  vs spot. */
export function ruleWeeklyBuybackActivity(
  s: Snapshot,
  now = new Date()
): Callout[] {
  const fills = s.buybacks?.buybacks?.fills || []
  if (fills.length === 0) return []
  const weekAgoTs = Math.floor(now.getTime() / 1000) - 7 * 86400
  const weekFills = fills.filter((f: any) => f.timestamp >= weekAgoTs)
  if (weekFills.length === 0) return []
  const usdsSpent = weekFills.reduce((acc: number, f: any) => acc + f.usdsSpent, 0)
  const spkBought = weekFills.reduce((acc: number, f: any) => acc + f.spkBought, 0)
  const avgPrice = spkBought > 0 ? usdsSpent / spkBought : 0
  const spot = s.spkToken?.current?.price ?? 0
  const discount =
    avgPrice > 0 && spot > 0 ? ((spot - avgPrice) / avgPrice) * 100 : null

  return [
    {
      section: "buyback",
      severity: "narrative",
      headline: `${weekFills.length} buyback ${weekFills.length === 1 ? "cycle" : "cycles"} settled this week`,
      body: `Spark deployed ${formatUsd(usdsSpent)} of USDS to acquire ${(spkBought / 1e6).toFixed(2)}M SPK at an average price of $${avgPrice.toFixed(5)}${
        discount != null
          ? `. Spot is ${discount >= 0 ? "above" : "below"} the weekly VWAP by ${Math.abs(discount).toFixed(1)}%.`
          : "."
      }`,
      metric: {
        label: "Weekly spend",
        value: formatUsd(usdsSpent),
        delta: discount != null ? formatPct(discount) : undefined,
      },
    },
  ]
}

/** Spark's share of Ethereum DeFi lending WoW. */
export function ruleSparkShareOfLending(s: Snapshot): Callout[] {
  const daily = s.peers?.daily
  const w = weekAgo(daily)
  if (!w) return []
  const latest = w.latest.sparkShare ?? 0
  const prior = w.prior.sparkShare ?? 0
  const deltaBps = (latest - prior) * 100
  if (Math.abs(deltaBps) < 25) return [] // < 25bps WoW is noise
  return [
    {
      section: "market_share",
      severity: "narrative",
      headline: `Spark's share of Ethereum lending: ${latest.toFixed(1)}% (${deltaBps >= 0 ? "+" : ""}${(deltaBps / 100).toFixed(2)}pp WoW)`,
      body: `Across Aave V3, Morpho Blue, SparkLend, Fluid, Compound V3, and Euler V2 on Ethereum, Spark now holds ${latest.toFixed(1)}% of outstanding loans — a ${deltaBps >= 0 ? "gain" : "loss"} of ${Math.abs(deltaBps / 100).toFixed(2)} percentage points versus 7 days ago.`,
      href: "https://www.datumlab.xyz/sparklend",
    },
  ]
}

/** Ecosystem TVL WoW with product-line split. */
export function ruleEcosystemTvl(s: Snapshot): Callout[] {
  const daily = s.ecosystem?.daily
  const w = weekAgo(daily)
  if (!w) return []
  const totalNow = w.latest.total ?? 0
  const totalWk = w.prior.total ?? 0
  if (totalWk === 0) return []
  const pct = ((totalNow - totalWk) / totalWk) * 100
  if (Math.abs(pct) < 2) return [] // < 2% WoW skip

  const parts: string[] = []
  for (const key of ["savings", "sparklend", "sll"] as const) {
    const now = w.latest[key] ?? 0
    const then = w.prior[key] ?? 0
    if (then > 0) {
      const p = ((now - then) / then) * 100
      const label =
        key === "sparklend" ? "SparkLend" : key === "sll" ? "SLL" : "Savings"
      parts.push(`${label} ${formatPct(p)}`)
    }
  }

  return [
    {
      section: "growth",
      severity: pct >= 0 ? "narrative" : "risk",
      headline: `Spark ecosystem TVL ${formatPct(pct)} WoW to ${formatUsd(totalNow, 2)}`,
      body: `Total TVL across Savings + SparkLend + Spark Liquidity Layer moved from ${formatUsd(totalWk, 2)} to ${formatUsd(totalNow, 2)}. Breakdown: ${parts.join(" · ")}.`,
      href: "https://www.datumlab.xyz/sparklend",
    },
  ]
}

/** YoY interest income vs peers — Spark growing while others shrink or not? */
export function rulePeerRevenueContext(s: Snapshot): Callout[] {
  const peers = s.peerRevenue?.peers as
    | Array<{ name: string; isSpark: boolean; yoyPct: number | null }>
    | undefined
  if (!peers?.length) return []
  const spark = peers.find((p) => p.isSpark)
  if (!spark || spark.yoyPct == null) return []
  const others = peers.filter((p) => !p.isSpark && p.yoyPct != null)
  if (!others.length) return []
  const avgOtherYoY =
    others.reduce((acc, p) => acc + (p.yoyPct ?? 0), 0) / others.length
  const gap = spark.yoyPct - avgOtherYoY
  // Only fire if the gap is at least 15pp — otherwise it's not narrative-worthy.
  if (Math.abs(gap) < 15) return []
  const framing =
    spark.yoyPct > 0 && avgOtherYoY < 0
      ? "Spark is the only major venue growing"
      : spark.yoyPct > avgOtherYoY
        ? "Spark is outperforming the peer set"
        : "Spark is trailing the peer set"
  return [
    {
      section: "growth",
      severity: "narrative",
      headline: `Interest income YoY: Spark ${formatPct(spark.yoyPct)}, peer avg ${formatPct(avgOtherYoY)} (${framing.toLowerCase()})`,
      body: `Trailing-90d interest income vs the prior 90d. ${framing} by ${Math.abs(gap).toFixed(0)}pp. Full peer breakdown: ${peers
        .map((p) => `${p.name} ${p.yoyPct == null ? "N/A" : formatPct(p.yoyPct)}`)
        .join(" · ")}.`,
      href: "https://www.datumlab.xyz/sparklend",
    },
  ]
}

/** Financials — weekly total-revenue change. */
export function ruleWeeklyRevenue(s: Snapshot): Callout[] {
  const daily = s.financials?.daily
  if (!daily || daily.length < 14) return []
  const week = daily.slice(-7)
  const prior = daily.slice(-14, -7)
  const sum = (arr: any[]) =>
    arr.reduce(
      (acc, d) =>
        acc + (d.sparklend ?? 0) + (d.savings ?? 0) + (d.sll ?? 0) + (d.distributionRewards ?? 0),
      0
    )
  const cur = sum(week)
  const pri = sum(prior)
  if (pri === 0) return []
  const pct = ((cur - pri) / pri) * 100
  if (Math.abs(pct) < 5) return [] // < 5% WoW skip
  return [
    {
      section: "growth",
      severity: pct >= 0 ? "info" : "risk",
      headline: `Spark net revenue: ${formatUsd(cur)} this week (${formatPct(pct)} WoW)`,
      body: `Aggregate net revenue across SparkLend interest, Savings sUSDS, SLL yield, and Sky distribution rewards. Prior week: ${formatUsd(pri)}.`,
      href: "https://www.datumlab.xyz/sparklend/financials",
    },
  ]
}

// ── Runner ───────────────────────────────────────────────────────────────────

export function runAllRules(s: Snapshot): Callout[] {
  const rules = [
    ruleBuybackCushion,
    ruleWeeklyBuybackActivity,
    ruleSparkShareOfLending,
    ruleEcosystemTvl,
    rulePeerRevenueContext,
    ruleWeeklyRevenue,
  ]
  const out: Callout[] = []
  for (const rule of rules) {
    try {
      out.push(...rule(s))
    } catch (e: any) {
      console.error(`Rule ${rule.name} failed:`, e.message)
    }
  }
  return out
}
