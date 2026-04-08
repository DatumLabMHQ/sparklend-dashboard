export interface TokenSnapshot {
  date: number
  tokens: Record<string, number>
}

export interface ChainTvlData {
  tvl: Array<{ date: number; totalLiquidityUSD: number }>
  tokensInUsd: TokenSnapshot[]
  tokens: Array<{ date: number; tokens: Record<string, number> }>
}

export interface DefiLlamaProtocol {
  chainTvls: {
    Ethereum: ChainTvlData
    "Ethereum-borrowed": ChainTvlData
    "Ethereum-staking"?: ChainTvlData
    xDai?: ChainTvlData
    "xDai-borrowed"?: ChainTvlData
  }
  currentChainTvls: Record<string, number>
}

export interface ProcessedDayData {
  date: string
  timestamp: number
  total: number
  [token: string]: string | number
}

export interface DashboardData {
  supply: ProcessedDayData[]
  borrow: ProcessedDayData[]
  liquidity: ProcessedDayData[]
  currentSupply: number
  currentBorrow: number
  currentLiquidity: number
  allSupplyTokens: string[]
  allBorrowTokens: string[]
  allLiquidityTokens: string[]
}
