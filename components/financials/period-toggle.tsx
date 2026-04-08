"use client"

export type Period = "D" | "W" | "M" | "Q" | "Y"

const LABELS: Record<Period, string> = {
  D: "Daily",
  W: "Weekly",
  M: "Monthly",
  Q: "Quarterly",
  Y: "Yearly",
}

export function PeriodToggle({
  selected,
  onChange,
}: {
  selected: Period
  onChange: (p: Period) => void
}) {
  return (
    <div className="flex bg-background rounded-md border border-card-border overflow-hidden">
      {(["D", "W", "M", "Q", "Y"] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          title={LABELS[p]}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            selected === p
              ? "bg-card-border text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
