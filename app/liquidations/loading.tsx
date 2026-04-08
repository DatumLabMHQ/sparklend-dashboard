export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-4 w-28 bg-card-bg rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
      </div>
      <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
        <div className="h-10 border-b border-card-border" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-card-border/50" />
        ))}
      </div>
    </div>
  )
}
