"use client"

import { useMemo } from "react"
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from "recharts"
import type { ReactElement, SVGProps } from "react"
import { ChartFrame } from "@/components/chart-frame"
import { useThemeColors } from "@/components/theme-provider"
import { formatUSD, getTokenName } from "@/lib/utils"

const METHODOLOGY = `Flow map of SparkLend on Ethereum:
• Left column: assets deposited as collateral (supply-side), by USD value.
• Middle node: the SparkLend pool itself.
• Right column: assets borrowed, by USD value.

Widths are proportional to USD. The dominant band is wstETH → SparkLend Pool → WETH — the leverage loop where stakers deposit wstETH, borrow WETH, and re-stake. Any other unusually thick band (e.g. cbBTC → USDS, sUSDe → USDC) tells you what other structured trades the pool is being used for.

Assets under 1% of either side are folded into "Other" to keep the chart readable. Data: DefiLlama /protocol/sparklend latest snapshot.`

interface Props {
  supplyTokens: Record<string, number>
  borrowTokens: Record<string, number>
}

const MIN_SHARE_PCT = 1
const CATEGORY_COLORS = [
  "#FF6B35", // Spark accent
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#818CF8",
  "#84cc16",
  "#78716c",
]

// Recharts clones this element and injects x/y/width/height/payload/containerWidth
// at render time — hence all props except `colors` are optional at the type
// level. Same pattern the Fluid dashboard uses for its Sankey node.
function SankeyNode(props: any) {
  const { x, y, width, height, payload, containerWidth = 800, colors } = props
  if (x == null || y == null || width == null || height == null || !payload) return null
  const isSource = x < containerWidth / 2
  const isPool = payload.name === "SparkLend Pool"
  const fill = payload.color || (isPool ? "#FF6B35" : colors.accent)
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={isPool ? 0.9 : 0.75} />
      <text
        x={isSource ? x - 8 : x + width + 8}
        y={y + height / 2 - 3}
        textAnchor={isSource ? "end" : "start"}
        fontSize={11}
        fill={colors.textPrimary}
        fontWeight={isPool ? 700 : 400}
      >
        {payload.name}
      </text>
      {payload.value > 0 && (
        <text
          x={isSource ? x - 8 : x + width + 8}
          y={y + height / 2 + 10}
          textAnchor={isSource ? "end" : "start"}
          fontSize={9}
          fill={colors.textMuted}
          fontFamily="JetBrains Mono, monospace"
        >
          {formatUSD(payload.value)}
        </text>
      )}
    </g>
  )
}

export function DepositsBorrowsSankey({ supplyTokens, borrowTokens }: Props) {
  const colors = useThemeColors()

  const { nodes, links, totals } = useMemo(() => {
    // Filter tokens by threshold, roll rest into "Other"
    function summariseSide(tokens: Record<string, number>) {
      const entries = Object.entries(tokens)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
      const total = entries.reduce((s, [_, v]) => s + (v as number), 0)
      const big: Array<[string, number]> = []
      let otherSum = 0
      for (const [k, v] of entries) {
        const share = total > 0 ? ((v as number) / total) * 100 : 0
        if (share >= MIN_SHARE_PCT) big.push([k, v as number])
        else otherSum += v as number
      }
      if (otherSum > 0) big.push(["Other", otherSum])
      return { entries: big, total }
    }

    const supply = summariseSide(supplyTokens)
    const borrow = summariseSide(borrowTokens)

    // Build nodes: [supply asset nodes..., pool node, borrow asset nodes...]
    // Prefix supply and borrow names because Sankey identifies by name and we
    // want the same asset (e.g. WETH on both sides) to show as two distinct nodes.
    const supplyNodes = supply.entries.map(([sym, val], i) => ({
      name: `${getTokenName(sym)} (supply)`,
      value: val,
      color: sym === "WSTETH" || sym === "wstETH" ? "#FF6B35" : CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
    const borrowNodes = borrow.entries.map(([sym, val], i) => ({
      name: `${getTokenName(sym)} (borrow)`,
      value: val,
      color: sym === "WETH" ? "#FF6B35" : CATEGORY_COLORS[(i + 3) % CATEGORY_COLORS.length],
    }))
    const poolNode = { name: "SparkLend Pool", value: supply.total, color: "#FF6B35" }
    const nodes = [...supplyNodes, poolNode, ...borrowNodes]
    const poolIdx = supplyNodes.length

    // Build links
    const links: Array<{ source: number; target: number; value: number }> = []
    supply.entries.forEach((_, i) => {
      links.push({ source: i, target: poolIdx, value: supply.entries[i][1] })
    })
    borrow.entries.forEach((_, i) => {
      links.push({ source: poolIdx, target: poolIdx + 1 + i, value: borrow.entries[i][1] })
    })

    return {
      nodes,
      links,
      totals: { supply: supply.total, borrow: borrow.total },
    }
  }, [supplyTokens, borrowTokens])

  const wstEthEntry = Object.entries(supplyTokens).find(
    ([k]) => k.toUpperCase() === "WSTETH"
  )
  const wethBorrowEntry = Object.entries(borrowTokens).find(
    ([k]) => k.toUpperCase() === "WETH"
  )
  const wstEthShare = wstEthEntry && totals.supply > 0
    ? ((wstEthEntry[1] as number) / totals.supply) * 100
    : 0
  const wethShare = wethBorrowEntry && totals.borrow > 0
    ? ((wethBorrowEntry[1] as number) / totals.borrow) * 100
    : 0

  return (
    <ChartFrame
      title="SparkLend Deposits → Borrows"
      subtitle="Where the money comes in from, where it goes out"
      units="USD flow"
      source="DefiLlama /protocol/sparklend latest per-token supply + borrow"
      methodology={METHODOLOGY}
      height={480}
      footnote={
        <span>
          Total supplied: <strong>{formatUSD(totals.supply)}</strong> · Total borrowed:{" "}
          <strong>{formatUSD(totals.borrow)}</strong> · Utilisation{" "}
          <strong>{totals.supply > 0 ? ((totals.borrow / totals.supply) * 100).toFixed(1) : "0"}%</strong>.
          Dominant flow: wstETH ({wstEthShare.toFixed(1)}% of supply) → WETH ({wethShare.toFixed(1)}% of borrow) —
          the leverage-stake loop. Any thick band that isn&apos;t this one is worth digging into.
        </span>
      }
    >
      <div style={{ height: 440 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={{ nodes, links }}
            nodePadding={20}
            nodeWidth={12}
            margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
            link={{ stroke: colors.textMuted, strokeOpacity: 0.15 }}
            node={<SankeyNode colors={colors} />}
          >
            <Tooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                // Recharts Sankey passes the top-level `item.name` for nodes;
                // the inner `item.payload` is the raw datum we supplied (with
                // `source`/`target` on links). Mirror the Fluid pattern.
                const item = payload[0]
                const pl = item?.payload ?? {}
                const isLink = pl?.source != null && pl?.target != null
                if (isLink) {
                  const srcName =
                    typeof pl.source === "number"
                      ? nodes[pl.source]?.name
                      : pl.source?.name
                  const tgtName =
                    typeof pl.target === "number"
                      ? nodes[pl.target]?.name
                      : pl.target?.name
                  return (
                    <div className="custom-tooltip min-w-[220px]">
                      <div className="text-xs text-text-secondary mb-1">
                        {srcName ?? "?"} → {tgtName ?? "?"}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Flow</span>
                        <span className="font-semibold text-text-primary">
                          {formatUSD(pl.value ?? item?.value ?? 0)}
                        </span>
                      </div>
                    </div>
                  )
                }
                // Node hover: prefer Recharts' item.name, fall back to pl.name.
                const nodeName = item?.name ?? pl?.name ?? "(unknown)"
                const nodeIdx = nodes.findIndex((n) => n.name === nodeName)
                const inflow = links
                  .filter((l) => l.target === nodeIdx)
                  .reduce((s, l) => s + l.value, 0)
                const outflow = links
                  .filter((l) => l.source === nodeIdx)
                  .reduce((s, l) => s + l.value, 0)
                const rawVal = pl?.value ?? item?.value
                const val =
                  typeof rawVal === "number" && !Number.isNaN(rawVal) && rawVal > 0
                    ? rawVal
                    : Math.max(inflow, outflow)
                return (
                  <div className="custom-tooltip min-w-[180px]">
                    <div className="text-xs text-text-secondary">{nodeName}</div>
                    <div className="flex justify-between text-xs mt-0.5">
                      <span className="text-text-secondary">Total</span>
                      <span className="font-semibold text-text-primary">
                        {formatUSD(val)}
                      </span>
                    </div>
                    {inflow > 0 && outflow > 0 && (
                      <div className="flex justify-between text-[10px] mt-0.5 text-text-muted">
                        <span>In {formatUSD(inflow)}</span>
                        <span>Out {formatUSD(outflow)}</span>
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
