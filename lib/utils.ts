export function formatUSD(value: number): string {
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(2)}K`
  }
  return `${sign}$${abs.toFixed(2)}`
}

export function formatUSDFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function formatDateFull(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// Token display name mapping
const TOKEN_NAMES: Record<string, string> = {
  WETH: "WETH",
  WSTETH: "wstETH",
  WBTC: "WBTC",
  SDAI: "sDAI",
  DAI: "DAI",
  USDC: "USDC",
  USDT: "USDT",
  RETH: "rETH",
  WEETH: "weETH",
  CBBTC: "cbBTC",
  SUSDS: "sUSDS",
  USDS: "USDS",
  LBTC: "LBTC",
  TBTCV2: "tBTC",
  EZETH: "ezETH",
  RSETH: "rsETH",
  PYUSD: "PYUSD",
  GNO: "GNO",
}

export function getTokenName(symbol: string): string {
  return TOKEN_NAMES[symbol] || symbol
}

// Chart color palette
const CHART_COLORS = [
  "#FF6B35", // datum orange
  "#8b5cf6", // purple
  "#22c55e", // green
  "#3b82f6", // blue
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#a855f7", // violet
  "#eab308", // yellow
  "#84cc16", // lime
  "#6366f1", // indigo
  "#d946ef", // fuchsia
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f43f5e", // rose
  "#78716c", // stone
]

export function getTokenColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

// --- Aave V3 math helpers ---

/** Convert RAY (1e27) value to percentage (e.g., 3.45 for 3.45%) */
export function rayToPercent(ray: bigint): number {
  return Number(ray) / 1e25 // ray / 1e27 * 100
}

/** Convert Oracle price (8 decimals) to USD */
export function oraclePriceToUSD(price: bigint): number {
  return Number(price) / 1e8
}

/** Format a percentage value */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

/** Format a raw token amount for display */
export function formatTokenAmount(amount: number, decimals: number = 2): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(decimals)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(decimals)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(decimals)}K`
  return amount.toFixed(decimals)
}
