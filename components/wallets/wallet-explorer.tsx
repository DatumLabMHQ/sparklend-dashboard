"use client"

interface WalletExplorerProps {
  allAssets: string[]
  search: string
  onSearchChange: (v: string) => void
  collateralFilter: string[]
  onCollateralFilterChange: (v: string[]) => void
  borrowFilter: string[]
  onBorrowFilterChange: (v: string[]) => void
  collateralMin: string
  collateralMax: string
  onCollateralMinChange: (v: string) => void
  onCollateralMaxChange: (v: string) => void
  borrowMin: string
  borrowMax: string
  onBorrowMinChange: (v: string) => void
  onBorrowMaxChange: (v: string) => void
  hfMin: string
  hfMax: string
  onHfMinChange: (v: string) => void
  onHfMaxChange: (v: string) => void
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-primary mb-1.5 block">
        {label}
      </label>
      <select
        multiple={false}
        value=""
        onChange={(e) => {
          const val = e.target.value
          if (val && !selected.includes(val)) {
            onChange([...selected, val])
          }
        }}
        className="w-full bg-background border border-card-border rounded-md px-3 py-2 text-xs text-text-secondary outline-none focus:border-text-muted"
      >
        <option value="">
          {selected.length > 0 ? selected.join(", ") : "All assets"}
        </option>
        {options
          .filter((o) => !selected.includes(o))
          .map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
      </select>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((s) => (
            <button
              key={s}
              onClick={() => onChange(selected.filter((x) => x !== s))}
              className="px-1.5 py-0.5 text-[10px] bg-card-border rounded text-text-secondary hover:text-text-primary"
            >
              {s} &times;
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RangeInput({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
  placeholder,
}: {
  label: string
  min: string
  max: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-primary mb-1.5 block">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Min"
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          className="flex-1 bg-background border border-card-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-text-muted placeholder:text-text-muted"
        />
        <input
          type="text"
          placeholder="Max"
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          className="flex-1 bg-background border border-card-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-text-muted placeholder:text-text-muted"
        />
      </div>
    </div>
  )
}

export function WalletExplorer(props: WalletExplorerProps) {
  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-5">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        Wallet Explorer
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Row 1 */}
        <div>
          <label className="text-xs font-medium text-text-primary mb-1.5 block">
            Wallet Address
          </label>
          <input
            type="text"
            placeholder="Search wallet..."
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            className="w-full bg-background border border-card-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-text-muted placeholder:text-text-muted"
          />
        </div>
        <MultiSelect
          label="Collateral Assets"
          options={props.allAssets}
          selected={props.collateralFilter}
          onChange={props.onCollateralFilterChange}
        />
        <MultiSelect
          label="Borrow Assets"
          options={props.allAssets}
          selected={props.borrowFilter}
          onChange={props.onBorrowFilterChange}
        />

        {/* Row 2 */}
        <RangeInput
          label="Collateral Range ($)"
          min={props.collateralMin}
          max={props.collateralMax}
          onMinChange={props.onCollateralMinChange}
          onMaxChange={props.onCollateralMaxChange}
        />
        <RangeInput
          label="Borrow Range ($)"
          min={props.borrowMin}
          max={props.borrowMax}
          onMinChange={props.onBorrowMinChange}
          onMaxChange={props.onBorrowMaxChange}
        />
        <RangeInput
          label="Health Factor Range"
          min={props.hfMin}
          max={props.hfMax}
          onMinChange={props.onHfMinChange}
          onMaxChange={props.onHfMaxChange}
        />
      </div>
    </div>
  )
}
