export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-4 w-20 bg-card-bg rounded" />
      <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
        <div className="h-10 border-b border-card-border" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-card-border/50" />
        ))}
      </div>
    </div>
  )
}
