export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-4 w-24 bg-card-bg rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card-bg border border-card-border rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-[340px] bg-card-bg border border-card-border rounded-lg" />
        <div className="h-[340px] bg-card-bg border border-card-border rounded-lg" />
      </div>
      <div className="h-[340px] bg-card-bg border border-card-border rounded-lg" />
    </div>
  )
}
