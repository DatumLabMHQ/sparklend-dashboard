import { NextRequest, NextResponse } from "next/server"
import {
  client,
  POOL,
  POOL_ADDRESSES_PROVIDER,
  poolAddressesProviderAbi,
  poolDataProviderAbi,
  poolAbi,
  oracleAbi,
  interestRateStrategyAbi,
} from "@/lib/contracts"
import { type Address } from "viem"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { asset: string } }
) {
  try {
    const assetSlug = params.asset.toLowerCase()

    // Step 1: Resolve addresses
    const addrResults = await client.multicall({
      contracts: [
        {
          address: POOL_ADDRESSES_PROVIDER,
          abi: poolAddressesProviderAbi,
          functionName: "getPoolDataProvider",
        },
        {
          address: POOL_ADDRESSES_PROVIDER,
          abi: poolAddressesProviderAbi,
          functionName: "getPriceOracle",
        },
      ],
    })

    const dataProviderAddr = addrResults[0].result as Address
    const oracleAddr = addrResults[1].result as Address

    // Step 2: Find the asset
    const reserveTokens = await client.readContract({
      address: dataProviderAddr,
      abi: poolDataProviderAbi,
      functionName: "getAllReservesTokens",
    })

    const token = reserveTokens.find(
      (r) => r.symbol.toLowerCase() === assetSlug
    )

    if (!token) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }

    const assetAddr = token.tokenAddress

    // Step 3: Single multicall for reserve data + config + caps + price + pool reserve
    const batch1 = await client.multicall({
      contracts: [
        {
          address: dataProviderAddr,
          abi: poolDataProviderAbi,
          functionName: "getReserveData",
          args: [assetAddr],
        },
        {
          address: dataProviderAddr,
          abi: poolDataProviderAbi,
          functionName: "getReserveConfigurationData",
          args: [assetAddr],
        },
        {
          address: dataProviderAddr,
          abi: poolDataProviderAbi,
          functionName: "getReserveCaps",
          args: [assetAddr],
        },
        {
          address: oracleAddr,
          abi: oracleAbi,
          functionName: "getAssetsPrices",
          args: [[assetAddr]],
        },
        {
          address: POOL,
          abi: poolAbi,
          functionName: "getReserveData",
          args: [assetAddr],
        },
      ],
    })

    const rd = batch1[0].result as any
    const cfg = batch1[1].result as any
    const caps = batch1[2].result as any
    const price = Number(((batch1[3].result || []) as bigint[])[0] || 0n) / 1e8
    const poolRd = batch1[4].result as any

    if (!rd || !cfg || !caps || !poolRd) {
      return NextResponse.json({ error: "Failed to read contract data" }, { status: 500 })
    }

    // Step 4: Read interest rate strategy params
    const strategyAddr = poolRd.interestRateStrategyAddress as Address

    const batch2 = await client.multicall({
      contracts: [
        {
          address: strategyAddr,
          abi: interestRateStrategyAbi,
          functionName: "getBaseVariableBorrowRate",
        },
        {
          address: strategyAddr,
          abi: interestRateStrategyAbi,
          functionName: "getVariableRateSlope1",
        },
        {
          address: strategyAddr,
          abi: interestRateStrategyAbi,
          functionName: "getVariableRateSlope2",
        },
        {
          address: strategyAddr,
          abi: interestRateStrategyAbi,
          functionName: "OPTIMAL_USAGE_RATIO",
        },
      ],
    })

    const decimals = Number(cfg[0])
    const divisor = Math.pow(10, decimals)
    const totalSupplyRaw = Number(rd[2]) / divisor
    const totalBorrowRaw = Number(rd[3]) / divisor + Number(rd[4]) / divisor
    const liquidityRaw = totalSupplyRaw - totalBorrowRaw
    const supplyCap = Number(caps[1])
    const borrowCap = Number(caps[0])
    const reserveFactor = Number(cfg[4]) / 10000

    const result = {
      symbol: token.symbol,
      address: assetAddr,
      price,
      decimals,
      totalSupply: totalSupplyRaw * price,
      totalSupplyRaw,
      totalBorrow: totalBorrowRaw * price,
      totalBorrowRaw,
      liquidity: liquidityRaw * price,
      liquidityRaw,
      supplyAPY: Number(rd[5]) / 1e25,
      borrowAPY: Number(rd[6]) / 1e25,
      utilization: totalSupplyRaw > 0 ? (totalBorrowRaw / totalSupplyRaw) * 100 : 0,
      ltv: Number(cfg[1]) / 100,
      liquidationThreshold: Number(cfg[2]) / 100,
      liquidationBonus: Number(cfg[3]) / 100 - 100,
      reserveFactor: reserveFactor * 100,
      supplyCap,
      borrowCap,
      supplyCapUtilization: supplyCap > 0 ? (totalSupplyRaw / supplyCap) * 100 : 0,
      borrowCapUtilization: borrowCap > 0 ? (totalBorrowRaw / borrowCap) * 100 : 0,
      baseRate: Number(batch2[0].result || 0n) / 1e25,
      slope1: Number(batch2[1].result || 0n) / 1e25,
      slope2: Number(batch2[2].result || 0n) / 1e25,
      optimalUtilization: Number(batch2[3].result || 0n) / 1e25,
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Asset detail API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch asset data", details: error.message },
      { status: 500 }
    )
  }
}
