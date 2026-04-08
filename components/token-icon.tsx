"use client"

import { useState } from "react"
import { getTokenName } from "@/lib/utils"

// Map token symbols to their Ethereum mainnet contract addresses (checksummed)
// Used to fetch logos from TrustWallet CDN
const TOKEN_ADDRESSES: Record<string, string> = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  WSTETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  LBTC: "0x8236a87084f8B84306f72007F36F2618A5634494",
  WEETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
  PYUSD: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
  USDS: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
  RETH: "0xae78736Cd615f374D3085123A210448E74Fc6393",
  EZETH: "0xbf5495Efe5DB9ce00f80364C8B423567e58d2110",
  CBBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  RSETH: "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7",
  SUSDS: "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD",
  TBTCV2: "0x18084fbA666a33d37592fA2633fD49a74DD93a88",
  SDAI: "0x83F20F44975D03b1b09e64809B757c47f942BEeA",
  GNO: "0x6810e776880C02933D47DB1b9fc05908e5386b96",
  CBETH: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
}

// Fallback colors for text icons
const TOKEN_COLORS: Record<string, { bg: string; text: string; abbr: string }> = {
  WETH:   { bg: "#627eea", text: "#fff", abbr: "Ξ" },
  WSTETH: { bg: "#00a3ff", text: "#fff", abbr: "wst" },
  WBTC:   { bg: "#f7931a", text: "#fff", abbr: "₿" },
  DAI:    { bg: "#f5ac37", text: "#fff", abbr: "$" },
  USDC:   { bg: "#2775ca", text: "#fff", abbr: "$" },
  USDT:   { bg: "#26a17b", text: "#fff", abbr: "₮" },
  LBTC:   { bg: "#0d1f3c", text: "#4da3ff", abbr: "₿" },
  WEETH:  { bg: "#7c3aed", text: "#fff", abbr: "wE" },
  PYUSD:  { bg: "#0070e0", text: "#fff", abbr: "PY" },
  USDS:   { bg: "#1bcc80", text: "#fff", abbr: "S" },
  RETH:   { bg: "#cc7833", text: "#fff", abbr: "rΞ" },
  EZETH:  { bg: "#73cbf0", text: "#1a1a2e", abbr: "ez" },
  CBBTC:  { bg: "#0052ff", text: "#fff", abbr: "cb" },
  RSETH:  { bg: "#34d399", text: "#1a1a2e", abbr: "rs" },
  SUSDS:  { bg: "#16a34a", text: "#fff", abbr: "sS" },
  TBTCV2: { bg: "#000", text: "#fff", abbr: "t₿" },
  SDAI:   { bg: "#e8a53a", text: "#fff", abbr: "sD" },
  GNO:    { bg: "#04795b", text: "#fff", abbr: "G" },
}

function getLogoUrl(symbol: string): string | null {
  const addr = TOKEN_ADDRESSES[symbol.toUpperCase()] || TOKEN_ADDRESSES[symbol]
  if (!addr) return null
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${addr}/logo.png`
}

function getFallback(symbol: string) {
  return TOKEN_COLORS[symbol.toUpperCase()] || TOKEN_COLORS[symbol] || {
    bg: "#52525b",
    text: "#fff",
    abbr: symbol.slice(0, 2),
  }
}

interface TokenIconProps {
  symbol: string
  size?: number
}

export function TokenIcon({ symbol, size = 28 }: TokenIconProps) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = getLogoUrl(symbol)
  const fallback = getFallback(symbol)

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={getTokenName(symbol)}
        width={size}
        height={size}
        className="rounded-full flex-shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    )
  }

  // Fallback to styled text
  const fontSize = size <= 20 ? 8 : size <= 28 ? 10 : 12
  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0 font-bold select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: fallback.bg,
        color: fallback.text,
        fontSize,
        lineHeight: 1,
        border: "1.5px solid rgba(255,255,255,0.1)",
      }}
      title={getTokenName(symbol)}
    >
      {fallback.abbr}
    </span>
  )
}
