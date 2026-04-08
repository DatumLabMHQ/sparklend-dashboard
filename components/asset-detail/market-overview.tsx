"use client"

import { formatUSD, formatPercent, formatTokenAmount, getTokenName } from "@/lib/utils"

interface MarketOverviewProps {
  symbol: string
  totalSupply: number
  totalSupplyRaw: number
  totalBorrow: number
  totalBorrowRaw: number
  liquidity: number
  liquidityRaw: number
  price: number
  utilization: number
}

function OverviewCard({
  label,
  usdValue,
  rawValue,
  rawSuffix,
}: {
  label: string
  usdValue: string
  rawValue?: string
  rawSuffix?: string
}) {
  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="mt-1.5">
        <span className="text-lg font-semibold text-text-primary">{usdValue}</span>
        {rawValue && (
          <p className="text-[11px] text-text-muted mt-0.5">
            {rawValue} {rawSuffix}
          </p>
        )}
      </div>
    </div>
  )
}

export function MarketOverview(props: MarketOverviewProps) {
  const sym = getTokenName(props.symbol)
  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
        Market Overview
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <OverviewCard
          label="Total Supply"
          usdValue={formatUSD(props.totalSupply)}
          rawValue={formatTokenAmount(props.totalSupplyRaw)}
          rawSuffix={sym}
        />
        <OverviewCard
          label="Total Borrow"
          usdValue={formatUSD(props.totalBorrow)}
          rawValue={formatTokenAmount(props.totalBorrowRaw)}
          rawSuffix={sym}
        />
        <OverviewCard
          label="Liquidity"
          usdValue={formatUSD(props.liquidity)}
          rawValue={formatTokenAmount(props.liquidityRaw)}
          rawSuffix={sym}
        />
        <OverviewCard
          label="Price"
          usdValue={
            props.price >= 1
              ? `$${props.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `$${props.price.toFixed(4)}`
          }
        />
        <OverviewCard
          label="Utilization"
          usdValue={formatPercent(props.utilization)}
        />
      </div>
    </div>
  )
}
