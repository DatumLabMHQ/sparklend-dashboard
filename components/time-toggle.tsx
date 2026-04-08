"use client"

interface TimeToggleProps {
  selected: number
  onChange: (days: number) => void
}

export function TimeToggle({ selected, onChange }: TimeToggleProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: "4px",
        border: "1px solid var(--card-border)",
        overflow: "hidden",
        backgroundColor: "var(--background)",
      }}
    >
      <button
        onClick={() => onChange(30)}
        style={{
          padding: "4px 12px",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          border: "none",
          fontFamily: "inherit",
          backgroundColor: selected === 30 ? "var(--card-border)" : "transparent",
          color: selected === 30 ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        30d
      </button>
      <button
        onClick={() => onChange(90)}
        style={{
          padding: "4px 12px",
          fontSize: "12px",
          fontWeight: 500,
          cursor: "pointer",
          border: "none",
          fontFamily: "inherit",
          backgroundColor: selected === 90 ? "var(--card-border)" : "transparent",
          color: selected === 90 ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        90d
      </button>
    </div>
  )
}
