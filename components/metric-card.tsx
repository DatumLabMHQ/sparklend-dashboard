"use client"

import { formatUSD } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: number
  change24h?: number
  icon?: React.ReactNode
  accentColor?: string
}

export function MetricCard({ label, value, change24h, icon, accentColor }: MetricCardProps) {
  const isPositive = change24h !== undefined && change24h >= 0
  const hasChange = change24h !== undefined && change24h !== 0

  return (
    <div className="tui-card bg-card-bg border border-card-border rounded-lg p-4 flex flex-col gap-1.5 relative overflow-hidden">
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px]"
        style={{ backgroundColor: accentColor || 'var(--accent)' }}
      />
      <div className="flex items-center gap-2 pl-2">
        {icon && <span style={{ color: accentColor || 'var(--accent)' }}>{icon}</span>}
        <span
          className="text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: accentColor || 'var(--accent)' }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap pl-2">
        <span className="text-xl font-semibold text-text-primary tabular-nums">
          {formatUSD(value)}
        </span>
        {hasChange && (
          <span
            className={`text-[10px] font-medium flex items-center gap-0.5 ${
              isPositive ? "text-success" : "text-danger"
            }`}
          >
            <span>{isPositive ? "\u25B2" : "\u25BC"}</span>
            {formatUSD(Math.abs(change24h!))}
            <span className="text-text-muted ml-0.5">24h</span>
          </span>
        )}
      </div>
    </div>
  )
}
