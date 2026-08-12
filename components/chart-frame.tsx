"use client"

import { Info } from "lucide-react"
import { useState, useRef, useCallback, type ReactNode } from "react"

/**
 * Shared frame for every chart in the SparkLend Terminal. Ports the Fluid
 * terminal aesthetic (tui-panel + methodology tooltip + @datumlabss watermark)
 * while preserving the ChartCard features that are critical for tweeting:
 * one-click screenshot (html2canvas) and full-screen expand.
 *
 * Titles are descriptive not editorial; methodology text lives in the (i)
 * tooltip; a `footnote` line at the bottom is the right place for the "live
 * value vs Q2 report" reconciliation callouts.
 */

function InfoTip({ text }: { text: ReactNode }) {
  return (
    <span className="relative inline-flex items-center group align-middle">
      <Info size={12} style={{ color: "var(--text-muted)", cursor: "help" }} />
      <span
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-0 top-5 z-50 w-72 p-2.5 rounded text-[10px] leading-relaxed normal-case tracking-normal font-normal"
        style={{
          background: "var(--tooltip-bg)",
          border: "1px solid var(--border-bright)",
          color: "var(--text-secondary)",
          boxShadow: "0 8px 32px var(--tooltip-shadow)",
          backdropFilter: "blur(12px)",
        }}
      >
        {text}
      </span>
    </span>
  )
}

interface ChartFrameProps {
  title: string
  subtitle?: string
  units?: string
  source?: string
  footnote?: ReactNode
  /** Definition + formula + implication, shown in an (i) tooltip. */
  methodology?: ReactNode
  /** Right-aligned controls (period toggle, USD/% toggle). Placed before screenshot/expand. */
  actions?: ReactNode
  /** Minimum chart-body height. Chart still expands to fill. */
  height?: number
  children: ReactNode
}

export function ChartFrame({
  title,
  subtitle,
  units,
  source = "DefiLlama + on-chain",
  footnote,
  methodology,
  actions,
  height = 280,
  children,
}: ChartFrameProps) {
  const [expanded, setExpanded] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const handleScreenshot = useCallback(async () => {
    if (!bodyRef.current) return
    try {
      const styles = getComputedStyle(document.documentElement)
      const bgColor = styles.getPropertyValue("--card-bg").trim()
      const borderColor = styles.getPropertyValue("--card-border").trim()
      const accentColor = styles.getPropertyValue("--accent").trim()
      const mutedColor = styles.getPropertyValue("--text-muted").trim()
      const primaryColor = styles.getPropertyValue("--text-primary").trim()

      const html2canvas = (await import("html2canvas")).default
      const chartCanvas = await html2canvas(bodyRef.current, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        logging: false,
      })

      const headerH = 48 * 2
      const footerH = 32 * 2
      const padding = 32
      const finalCanvas = document.createElement("canvas")
      finalCanvas.width = chartCanvas.width + padding
      finalCanvas.height = chartCanvas.height + headerH + footerH + padding

      const ctx = finalCanvas.getContext("2d")!
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)

      // Border
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, finalCanvas.width - 2, finalCanvas.height - 2)

      // Header separator
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, headerH)
      ctx.lineTo(finalCanvas.width, headerH)
      ctx.stroke()

      // Title (primary color, matches on-screen)
      ctx.fillStyle = primaryColor
      ctx.font = "bold 22px 'JetBrains Mono', monospace"
      ctx.textBaseline = "middle"
      ctx.fillText(title, padding, headerH / 2)

      if (subtitle) {
        const titleWidth = ctx.measureText(title).width
        ctx.fillStyle = mutedColor
        ctx.font = "16px 'JetBrains Mono', monospace"
        ctx.fillText(`— ${subtitle}`, padding + titleWidth + 16, headerH / 2)
      }

      // Chart
      ctx.drawImage(chartCanvas, padding / 2, headerH)

      // Footer: source (left) + @datumlabss watermark (right)
      const footerY = headerH + chartCanvas.height + footerH / 2
      ctx.fillStyle = mutedColor
      ctx.font = "18px 'JetBrains Mono', monospace"
      ctx.textAlign = "start"
      ctx.fillText(source, padding, footerY)
      ctx.font = "bold 20px 'JetBrains Mono', monospace"
      ctx.textAlign = "end"
      ctx.fillStyle = accentColor
      ctx.fillText("@datumlabss", finalCanvas.width - padding, footerY)
      ctx.textAlign = "start"

      const link = document.createElement("a")
      link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-chart.png`
      link.href = finalCanvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error("Screenshot error:", err)
      alert("Screenshot failed. Please try again.")
    }
  }, [title, subtitle, source])

  const frameContent = (
    <>
      <figcaption className="px-4 pt-3 pb-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3
            className="text-[13px] font-bold tracking-tight flex items-center gap-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
            {methodology && <InfoTip text={methodology} />}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {units && (
              <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">
                {units}
              </span>
            )}
            {actions}
            <button
              onClick={handleScreenshot}
              className="p-1 rounded transition-colors"
              style={{ backgroundColor: "transparent", color: "var(--text-muted)" }}
              onMouseOver={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--hover-overlay)"
              }}
              onMouseOut={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = "transparent"
              }}
              title="Screenshot"
              aria-label="Screenshot"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1 rounded transition-colors"
              style={{ backgroundColor: "transparent", color: "var(--text-muted)" }}
              onMouseOver={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--hover-overlay)"
              }}
              onMouseOut={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = "transparent"
              }}
              title={expanded ? "Collapse" : "Expand"}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        {subtitle && (
          <div className="text-[10px] text-text-muted mt-0.5">{subtitle}</div>
        )}
      </figcaption>

      <div
        ref={bodyRef}
        className={expanded ? "flex-1 px-2" : "px-2"}
        style={expanded ? undefined : { minHeight: height }}
      >
        {children}
      </div>

      <div className="flex items-center justify-between px-4 py-2 mt-1">
        <span className="text-[9px] text-text-muted" style={{ letterSpacing: "0.04em" }}>
          {source}
        </span>
        <span
          className="text-[9px] font-semibold"
          style={{ color: "var(--text-muted)", opacity: 0.7, letterSpacing: "0.06em" }}
        >
          @datumlabss
        </span>
      </div>
      {footnote && (
        <div className="px-4 pb-3 text-[9px] text-text-muted leading-relaxed">
          {footnote}
        </div>
      )}
    </>
  )

  if (expanded) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
        <figure className="tui-panel fixed inset-4 z-50 flex flex-col overflow-auto">
          {frameContent}
        </figure>
      </>
    )
  }

  return (
    <figure className="tui-panel relative flex flex-col">
      {frameContent}
    </figure>
  )
}
