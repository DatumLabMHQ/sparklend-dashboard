"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "./theme-provider"
import { prefetchData } from "@/lib/use-cached-fetch"

// basePath prefix for raw asset URLs. Next.js auto-prefixes <Link>, router,
// and static imports, but a plain <img src="/x.png"> is passed straight
// through — so we prefix it ourselves. Same var the fetch hook uses.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""
const asset = (path: string) => `${BASE_PATH}${path}`

// Prefetch API data on nav hover to speed up page loads. Routes through
// the shared cache so basePath-aware fetches deduplicate cleanly.
const API_MAP: Record<string, string[]> = {
  "/": ["/api/sparklend", "/api/ecosystem", "/api/peers"],
  "/markets": ["/api/markets"],
  "/savings": ["/api/ecosystem"],
  "/liquidity-layer": ["/api/ecosystem", "/api/financials"],
  "/financials": ["/api/financials"],
  "/spk-token": ["/api/spk-token"],
}

function prefetchApis(href: string) {
  const apis = API_MAP[href]
  if (!apis) return
  apis.forEach((url) => prefetchData(url))
}

const DASHBOARD_TITLE = "SparkLend Terminal"

export function NavHeader() {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  // 6-item ecosystem navigation matching Spark's 3-product framing.
  // Wallets + Liquidations still accessible by direct URL — Phase 4 will
  // fold them into franchise views under SparkLend.
  const navItems = [
    { href: "/", label: "Overview" },
    { href: "/markets", label: "SparkLend" },
    { href: "/savings", label: "Savings" },
    { href: "/liquidity-layer", label: "Liquidity Layer" },
    { href: "/financials", label: "Financials" },
    { href: "/spk-token", label: "$SPK" },
  ]

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <>
      {/* Top Navigation Bar */}
      <nav style={{ borderBottom: "1px solid var(--card-border)", background: "var(--panel-header)" }}>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 flex items-center justify-between h-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset("/branding/icon.png")}
                alt="Datum Labs"
                width={22}
                height={22}
                className="rounded-sm"
              />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                |
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "var(--text-muted)" }}
              >
                {DASHBOARD_TITLE}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onMouseEnter={() => prefetchApis(item.href)}
                    className={`px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] rounded-sm transition-colors ${
                      active ? "nav-active" : ""
                    }`}
                    style={{
                      color: active ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Live indicator - terminal-style blinking dot */}
            <span
              className="inline-flex items-center gap-1.5 text-[10px]"
              style={{ color: "var(--success)" }}
            >
              <span className="terminal-blink">●</span>
              <span className="hidden sm:inline uppercase tracking-[0.1em]">Live</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      <div
        className="md:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--card-border)", background: "var(--panel-header)" }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] rounded-sm whitespace-nowrap transition-colors ${
                active ? "nav-active" : ""
              }`}
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </>
  )
}
