export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 animate-pulse space-y-4">
      <div className="h-4 w-40 bg-card-bg rounded" />
      <div className="h-32 bg-card-bg border border-card-border rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-card-bg border border-card-border rounded-lg" />
        <div className="h-48 bg-card-bg border border-card-border rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
        <div className="h-[300px] bg-card-bg border border-card-border rounded-lg" />
      </div>
    </div>
  )
}
