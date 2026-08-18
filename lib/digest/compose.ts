/**
 * Compose the weekly Spark digest. Two outputs:
 *  - HTML (for Resend / email clients)
 *  - Plain text (for accessibility fallback and quick previews)
 *
 * The composer takes the callouts from rules.ts and groups them into
 * sections. Each section has a section header + a small stack of
 * callout cards. Rendering intentionally stays inline-CSS-only so the
 * email survives Gmail's aggressive stripping.
 */
import type { Callout } from "./rules"

const SECTION_ORDER = [
  "buyback",
  "market_share",
  "growth",
  "risk",
  "product",
] as const

const SECTION_META: Record<
  (typeof SECTION_ORDER)[number],
  { title: string; emoji: string }
> = {
  buyback: { title: "Buyback pulse", emoji: "🎯" },
  market_share: { title: "Market share", emoji: "📈" },
  growth: { title: "Growth", emoji: "🌱" },
  risk: { title: "Risk callouts", emoji: "⚠️" },
  product: { title: "Product mechanics", emoji: "🔧" },
}

const COLORS = {
  bg: "#0B0D11",
  panel: "#12151B",
  border: "#252A34",
  text: "#E5E7EB",
  textMuted: "#8B92A1",
  accent: "#FF6B35",
  green: "#22c55e",
  red: "#F26B68",
  divider: "#1E232C",
}

function severityColor(sev: Callout["severity"]): string {
  if (sev === "risk") return COLORS.red
  if (sev === "narrative") return COLORS.accent
  return COLORS.green
}

function weekLabel(now = new Date()): string {
  const end = new Date(now)
  const start = new Date(end.getTime() - 6 * 86400_000)
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ── Text output ──────────────────────────────────────────────────────────────

export function composeText(callouts: Callout[], now = new Date()): string {
  const lines: string[] = []
  lines.push(`Spark Week - ${weekLabel(now)}`)
  lines.push("=".repeat(50))
  lines.push("")

  if (callouts.length === 0) {
    lines.push("Nothing meaningful moved this week. Quiet is a data point.")
    lines.push("")
    lines.push("Dashboard: https://www.datumlab.xyz/sparklend")
    return lines.join("\n")
  }

  for (const section of SECTION_ORDER) {
    const items = callouts.filter((c) => c.section === section)
    if (items.length === 0) continue
    lines.push(`${SECTION_META[section].emoji} ${SECTION_META[section].title}`)
    lines.push("-".repeat(40))
    for (const c of items) {
      lines.push("")
      lines.push(`  ${c.headline}`)
      lines.push(`  ${c.body}`)
      if (c.href) lines.push(`  -> ${c.href}`)
    }
    lines.push("")
  }
  lines.push("")
  lines.push("Full dashboard: https://www.datumlab.xyz/sparklend")
  lines.push("Compiled by @datumlabss")
  return lines.join("\n")
}

// ── HTML output ──────────────────────────────────────────────────────────────

function calloutHtml(c: Callout): string {
  const stripe = severityColor(c.severity)
  const metric = c.metric
    ? `<div style="margin-top:8px; font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.05em;">
         ${esc(c.metric.label)}:
         <span style="color:${COLORS.text}; font-weight:600;">${esc(c.metric.value)}</span>
         ${c.metric.delta ? `<span style="color:${stripe}; margin-left:6px;">${esc(c.metric.delta)}</span>` : ""}
       </div>`
    : ""
  const link = c.href
    ? `<div style="margin-top:10px;"><a href="${esc(c.href)}" style="color:${COLORS.accent}; text-decoration:none; font-size:11px; text-transform:uppercase; letter-spacing:0.05em;">View on dashboard →</a></div>`
    : ""
  return `<div style="background:${COLORS.panel}; border:1px solid ${COLORS.border}; border-left:3px solid ${stripe}; border-radius:4px; padding:16px 18px; margin-bottom:10px;">
    <div style="font-size:14px; font-weight:600; color:${COLORS.text}; line-height:1.4; margin-bottom:6px;">${esc(c.headline)}</div>
    <div style="font-size:13px; color:${COLORS.textMuted}; line-height:1.55;">${esc(c.body)}</div>
    ${metric}
    ${link}
  </div>`
}

export function composeHtml(callouts: Callout[], now = new Date()): string {
  const sections: string[] = []
  for (const section of SECTION_ORDER) {
    const items = callouts.filter((c) => c.section === section)
    if (items.length === 0) continue
    const meta = SECTION_META[section]
    sections.push(`
      <div style="margin-bottom:24px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="font-size:16px;">${meta.emoji}</span>
          <span style="font-size:11px; font-weight:700; color:${COLORS.accent}; letter-spacing:0.15em; text-transform:uppercase;">${meta.title}</span>
          <span style="flex:1; height:1px; background:${COLORS.divider};"></span>
        </div>
        ${items.map(calloutHtml).join("")}
      </div>
    `)
  }

  const emptyState =
    callouts.length === 0
      ? `<div style="background:${COLORS.panel}; border:1px solid ${COLORS.border}; padding:24px; text-align:center; color:${COLORS.textMuted}; font-size:13px;">
           Nothing meaningful moved this week. Quiet is a data point.
         </div>`
      : ""

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spark Week</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.bg}; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;">
  <div style="max-width:640px; margin:0 auto; padding:32px 20px;">

    <!-- Header -->
    <div style="border-bottom:1px solid ${COLORS.divider}; padding-bottom:18px; margin-bottom:24px;">
      <div style="font-size:11px; color:${COLORS.textMuted}; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:4px;">Spark Week</div>
      <div style="font-size:22px; font-weight:700; color:${COLORS.text}; letter-spacing:-0.01em;">${esc(weekLabel(now))}</div>
      <div style="font-size:12px; color:${COLORS.textMuted}; margin-top:6px;">
        Compiled from datumlab.xyz/sparklend · @datumlabss
      </div>
    </div>

    ${emptyState}
    ${sections.join("")}

    <!-- Footer -->
    <div style="border-top:1px solid ${COLORS.divider}; padding-top:16px; margin-top:20px; color:${COLORS.textMuted}; font-size:11px; line-height:1.6;">
      Full dashboard:
      <a href="https://www.datumlab.xyz/sparklend" style="color:${COLORS.accent}; text-decoration:none;">datumlab.xyz/sparklend</a><br />
      Methodology: each callout is a rule fire — thresholds documented in the source.
      Silent quiet is intentional: if a metric moved less than its floor, it isn't shown.
    </div>
  </div>
</body>
</html>`
}

export function composeSubject(
  callouts: Callout[],
  now = new Date()
): string {
  if (callouts.length === 0) {
    return `Spark Week · quiet week · ${weekLabel(now)}`
  }
  // Pick the most narrative-worthy callout for the subject teaser.
  const priority = callouts.find((c) => c.severity === "narrative")
  const teaser = priority ? priority.headline : callouts[0].headline
  // Trim to keep the Gmail preview readable.
  const truncated = teaser.length > 70 ? teaser.slice(0, 67) + "…" : teaser
  return `Spark Week · ${truncated}`
}
