import { DashboardData, ProcessedDayData, TokenSnapshot } from "./types"
import { formatDate } from "./utils"

const DEFILLAMA_URL = "https://api.llama.fi/protocol/sparklend"

function processTokenSnapshots(
  snapshots: TokenSnapshot[],
  daysBack: number
): { data: ProcessedDayData[]; allTokens: string[] } {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - daysBack * 24 * 60 * 60

  const filtered = snapshots.filter((s) => s.date >= cutoff)
  const tokenSet = new Set<string>()

  // Collect all tokens across all snapshots
  filtered.forEach((s) => {
    Object.keys(s.tokens).forEach((t) => tokenSet.add(t))
  })

  // Sort tokens by their value in the most recent snapshot (descending)
  const lastSnapshot = filtered[filtered.length - 1]
  const allTokens = Array.from(tokenSet).sort((a, b) => {
    const valA = lastSnapshot?.tokens[a] || 0
    const valB = lastSnapshot?.tokens[b] || 0
    return valB - valA
  })

  const data: ProcessedDayData[] = filtered.map((snapshot) => {
    const total = Object.values(snapshot.tokens).reduce((sum, v) => sum + v, 0)
    const entry: ProcessedDayData = {
      date: formatDate(snapshot.date),
      timestamp: snapshot.date,
      total,
    }
    allTokens.forEach((token) => {
      entry[token] = snapshot.tokens[token] || 0
    })
    return entry
  })

  return { data, allTokens }
}

function computeLiquidity(
  supplySnapshots: TokenSnapshot[],
  borrowSnapshots: TokenSnapshot[],
  daysBack: number
): { data: ProcessedDayData[]; allTokens: string[] } {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - daysBack * 24 * 60 * 60

  const supplyFiltered = supplySnapshots.filter((s) => s.date >= cutoff)
  const borrowFiltered = borrowSnapshots.filter((s) => s.date >= cutoff)

  // Build a borrow lookup by date
  const borrowByDate = new Map<number, Record<string, number>>()
  borrowFiltered.forEach((s) => {
    borrowByDate.set(s.date, s.tokens)
  })

  // Collect all tokens from supply
  const tokenSet = new Set<string>()
  supplyFiltered.forEach((s) => {
    Object.keys(s.tokens).forEach((t) => tokenSet.add(t))
  })

  const lastSupply = supplyFiltered[supplyFiltered.length - 1]
  const lastBorrow = borrowByDate.get(lastSupply?.date) || {}

  const allTokens = Array.from(tokenSet).sort((a, b) => {
    const liqA = (lastSupply?.tokens[a] || 0) - (lastBorrow[a] || 0)
    const liqB = (lastSupply?.tokens[b] || 0) - (lastBorrow[b] || 0)
    return liqB - liqA
  })

  const data: ProcessedDayData[] = supplyFiltered.map((snapshot) => {
    const borrowTokens = borrowByDate.get(snapshot.date) || {}
    let total = 0
    const entry: ProcessedDayData = {
      date: formatDate(snapshot.date),
      timestamp: snapshot.date,
      total: 0,
    }

    allTokens.forEach((token) => {
      const supplied = snapshot.tokens[token] || 0
      const borrowed = borrowTokens[token] || 0
      const liquidity = Math.max(0, supplied - borrowed)
      entry[token] = liquidity
      total += liquidity
    })

    entry.total = total
    return entry
  })

  return { data, allTokens }
}

export async function fetchDashboardData(
  days: number = 30
): Promise<DashboardData> {
  const res = await fetch(DEFILLAMA_URL, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error("Failed to fetch SparkLend data")

  const protocol = await res.json()

  const ethSupply = protocol.chainTvls["Ethereum"]
  const ethBorrow = protocol.chainTvls["Ethereum-borrowed"]

  const supplyResult = processTokenSnapshots(
    ethSupply.tokensInUsd,
    days
  )
  const borrowResult = processTokenSnapshots(
    ethBorrow.tokensInUsd,
    days
  )
  const liquidityResult = computeLiquidity(
    ethSupply.tokensInUsd,
    ethBorrow.tokensInUsd,
    days
  )

  const currentSupply = protocol.currentChainTvls["Ethereum"] || 0
  const currentBorrow = protocol.currentChainTvls["Ethereum-borrowed"] || 0

  return {
    supply: supplyResult.data,
    borrow: borrowResult.data,
    liquidity: liquidityResult.data,
    currentSupply,
    currentBorrow,
    currentLiquidity: currentSupply - currentBorrow,
    allSupplyTokens: supplyResult.allTokens,
    allBorrowTokens: borrowResult.allTokens,
    allLiquidityTokens: liquidityResult.allTokens,
  }
}
