"use client"

import { useState, useRef, useEffect, useCallback } from "react"

export function MethodologyTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Reposition panel to stay within viewport
  const adjustPosition = useCallback(() => {
    if (!panelRef.current) return
    const panel = panelRef.current
    const rect = panel.getBoundingClientRect()

    // Horizontal: prevent overflow right
    if (rect.right > window.innerWidth - 16) {
      panel.style.left = "auto"
      panel.style.right = "0px"
    }
    // Horizontal: prevent overflow left
    if (rect.left < 16) {
      panel.style.right = "auto"
      panel.style.left = "0px"
    }
    // Vertical: if it goes below viewport, show above the button
    if (rect.bottom > window.innerHeight - 16) {
      panel.style.top = "auto"
      panel.style.bottom = "calc(100% + 6px)"
    }
  }, [])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(adjustPosition)
    }
  }, [open, adjustPosition])

  return (
    <div className="relative inline-flex items-center ml-1.5" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-[15px] h-[15px] rounded-full border border-card-border text-text-muted flex items-center justify-center text-[8px] hover:border-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
        title="Methodology"
      >
        i
      </button>
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[340px] bg-[#141425] border border-card-border rounded-lg p-4 shadow-2xl"
          style={{ maxHeight: "70vh", overflowY: "auto" }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Methodology
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-text-muted hover:text-text-primary text-sm leading-none"
            >
              &times;
            </button>
          </div>
          <p className="text-[11px] leading-[1.65] text-text-secondary whitespace-pre-line">
            {text}
          </p>
        </div>
      )}
    </div>
  )
}
