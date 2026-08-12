/**
 * Footer with source attribution + Datum Labs credit. The credit + handle ride
 * on every screenshot — free distribution.
 */
export function SiteFooter() {
  return (
    <footer
      className="mt-8 pt-5 pb-4 text-[10px] leading-relaxed"
      style={{ borderTop: "1px solid var(--card-border)", color: "var(--text-muted)" }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="max-w-2xl">
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
            Sources:
          </span>{" "}
          Protocol TVL, per-chain splits, fees, and revenue from DefiLlama (public API).
          On-chain reads (flashloan events, liquidation events, Sky Distribution Reward mints,
          user positions) via public RPCs (mevblocker, publicnode, ankr, llamarpc).
          Figures refresh on load; on-chain scans cache for ~30 min and are seeded with a build-time baseline.
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://app.spark.fi"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-primary"
          >
            spark.fi
          </a>
          <a
            href="https://defillama.com/protocol/spark"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-primary"
          >
            DefiLlama
          </a>
          <span style={{ color: "var(--border-bright)" }}>|</span>
          <span style={{ color: "var(--text-secondary)" }}>
            Built by Datum Labs · <a href="https://x.com/datumlabss" target="_blank" rel="noreferrer" className="hover:text-accent">@datumlabss</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
