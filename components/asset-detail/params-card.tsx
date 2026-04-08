"use client"

interface ParamRow {
  label: string
  value: string
}

interface ParamsCardProps {
  title: string
  params: ParamRow[]
}

export function ParamsCard({ title, params }: ParamsCardProps) {
  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
        {title}
      </h3>
      <div className="space-y-3">
        {params.map((p) => (
          <div key={p.label} className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">{p.label}</span>
            <span className="text-xs font-medium text-text-primary">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
