export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-4 w-20 bg-card-bg rounded" />
      <div className="bg-card-bg border border-card-border rounded-lg p-5 space-y-4">
        <div className="h-5 w-40 bg-card-border rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-background rounded-md" />
          ))}
        </div>
      </div>
      <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
        <div className="h-10 border-b border-card-border" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-card-border/50" />
        ))}
      </div>
    </div>
  )
}
