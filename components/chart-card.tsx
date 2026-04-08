"use client"

import { useState, useRef, useCallback, type ReactNode } from "react"

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** Extra controls (toggles, period selectors) placed in the header */
  actions?: ReactNode
  /** Chart height class when not expanded (default h-[280px]) */
  heightClass?: string
}

export function ChartCard({
  title,
  subtitle,
  children,
  actions,
  heightClass = "h-[280px]",
}: ChartCardProps) {
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const handleScreenshot = useCallback(async () => {
    if (!bodyRef.current) return
    try {
      // Get computed theme colors from the page
      const styles = getComputedStyle(document.documentElement)
      const bgColor = styles.getPropertyValue("--card-bg").trim()
      const borderColor = styles.getPropertyValue("--card-border").trim()
      const accentColor = styles.getPropertyValue("--accent").trim()
      const mutedColor = styles.getPropertyValue("--text-muted").trim()

      const html2canvas = (await import("html2canvas")).default
      const chartEl = bodyRef.current

      // Capture ONLY the chart body (skip the header which renders poorly)
      const chartCanvas = await html2canvas(chartEl, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      })

      // Create a new canvas with space for a manually drawn header
      const headerHeight = 48 * 2 // 48px header at 2x scale
      const padding = 32 // 16px padding at 2x
      const finalCanvas = document.createElement("canvas")
      finalCanvas.width = chartCanvas.width + padding
      finalCanvas.height = chartCanvas.height + headerHeight + padding

      const ctx = finalCanvas.getContext("2d")!

      // Fill background
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)

      // Draw border
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, finalCanvas.width - 2, finalCanvas.height - 2)

      // Draw header separator
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, headerHeight)
      ctx.lineTo(finalCanvas.width, headerHeight)
      ctx.stroke()

      // Draw title text
      ctx.fillStyle = accentColor
      ctx.font = "bold 22px 'JetBrains Mono', monospace"
      ctx.textBaseline = "middle"
      ctx.fillText(title.toUpperCase(), padding, headerHeight / 2)

      // Draw subtitle if present
      if (subtitle) {
        const titleWidth = ctx.measureText(title.toUpperCase()).width
        ctx.fillStyle = mutedColor
        ctx.font = "18px 'JetBrains Mono', monospace"
        ctx.fillText(`— ${subtitle}`, padding + titleWidth + 16, headerHeight / 2)
      }

      // Draw watermark - subtle, not distracting
      ctx.fillStyle = mutedColor
      ctx.globalAlpha = 0.04
      ctx.font = "bold 72px 'JetBrains Mono', monospace"
      ctx.textAlign = "center"
      ctx.fillText("Datum Labs", finalCanvas.width / 2, headerHeight + chartCanvas.height / 2)
      ctx.globalAlpha = 1
      ctx.textAlign = "start"

      // Draw the chart below the header
      ctx.drawImage(chartCanvas, padding / 2, headerHeight)

      // Download
      const link = document.createElement("a")
      link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-chart.png`
      link.href = finalCanvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error("Screenshot error:", err)
      alert("Screenshot failed. Please try again.")
    }
  }, [title, subtitle])

  return (
    <>
      {/* Fullscreen overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        ref={cardRef}
        className={
          expanded
            ? "fixed inset-4 z-50 flex flex-col bg-card-bg border border-card-border rounded overflow-hidden"
            : "tui-card bg-card-bg border border-card-border rounded overflow-hidden"
        }
      >
        {/* Header */}
        <div
          className="border-b border-card-border"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
            <span
              className="text-accent"
              style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}
            >
              {title}
            </span>
            {subtitle && (
              <span
                className="text-text-muted hidden sm:inline"
                style={{ fontSize: "9px", letterSpacing: "0.05em", whiteSpace: "nowrap" }}
              >
                — {subtitle}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            {actions}

            {/* Screenshot button */}
            <button
              onClick={handleScreenshot}
              className="p-1 rounded transition-colors"
              style={{ backgroundColor: "transparent" }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--hover-overlay)" }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent" }}
              title="Screenshot"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-text-muted"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>

            {/* Expand button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded transition-colors"
              style={{ backgroundColor: "transparent" }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--hover-overlay)" }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent" }}
              title={expanded ? "Collapse" : "Expand"}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-text-muted"
              >
                {expanded ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} className={`relative ${expanded ? "flex-1" : `p-4 ${heightClass}`}`}>
          {children}
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-4xl font-bold tracking-wider select-none" style={{ color: "var(--text-muted)", opacity: 0.04 }}>
              Datum Labs
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
