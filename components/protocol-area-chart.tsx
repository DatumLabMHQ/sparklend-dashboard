"use client"

import { useState, useCallback } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ProcessedDayData } from "@/lib/types"
import { formatUSD, formatUSDFull, formatDateFull, getTokenName, getTokenColor } from "@/lib/utils"
import { TimeToggle } from "./time-toggle"
import { ChartFrame } from "./chart-frame"
import { useThemeColors } from "./theme-provider"

interface ProtocolAreaChartProps {
  title: string
  subtitle: string
  data30d: ProcessedDayData[]
  data90d: ProcessedDayData[]
  allTokens30d: string[]
  allTokens90d: string[]
}

function CustomTooltip({
  active,
  payload,
  label,
  allTokens,
  tokenColors,
}: any) {
  if (!active || !payload || !payload.length) return null

  const dataPoint = payload[0]?.payload
  if (!dataPoint) return null

  // Build sorted token list from current data point
  const tokenValues = allTokens
    .map((token: string) => ({
      token,
      value: (dataPoint[token] as number) || 0,
    }))
    .filter((t: { value: number }) => t.value > 0)
    .sort((a: { value: number }, b: { value: number }) => b.value - a.value)

  const total = tokenValues.reduce(
    (sum: number, t: { value: number }) => sum + t.value,
    0
  )

  return (
    <div className="custom-tooltip min-w-[220px]">
      <p className="text-xs text-text-muted mb-2">
        {formatDateFull(dataPoint.timestamp)}
      </p>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {tokenValues.map(
          (t: { token: string; value: number }, i: number) => (
            <div key={t.token} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tokenColors[t.token] }}
                />
                <span className="text-xs text-text-secondary">
                  {getTokenName(t.token)}
                </span>
              </div>
              <span className="text-xs font-medium text-text-primary">
                {formatUSD(t.value)}
              </span>
            </div>
          )
        )}
      </div>
      <div className="border-t border-card-border mt-2 pt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">Total</span>
        <span className="text-sm font-semibold text-text-primary">
          {formatUSD(total)}
        </span>
      </div>
    </div>
  )
}

export function ProtocolAreaChart({
  title,
  subtitle,
  data30d,
  data90d,
  allTokens30d,
  allTokens90d,
}: ProtocolAreaChartProps) {
  const [days, setDays] = useState(30)
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const colors = useThemeColors()

  const data = days === 30 ? data30d : data90d
  const allTokens = days === 30 ? allTokens30d : allTokens90d

  // Build color map
  const tokenColors: Record<string, string> = {}
  allTokens.forEach((token, i) => {
    tokenColors[token] = getTokenColor(i)
  })

  const displayTokens = selectedToken ? [selectedToken] : allTokens

  const chartActions = (
    <div className="flex items-center gap-2">
      <select
        value={selectedToken || "all"}
        onChange={(e) =>
          setSelectedToken(e.target.value === "all" ? null : e.target.value)
        }
        style={{
          backgroundColor: "var(--background)",
          border: "1px solid var(--card-border)",
          borderRadius: "3px",
          padding: "2px 6px",
          fontSize: "10px",
          color: "var(--text-secondary)",
          outline: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <option value="all">Assets ({allTokens.length})</option>
        {allTokens.map((token) => (
          <option key={token} value={token}>
            {getTokenName(token)}
          </option>
        ))}
      </select>
      <TimeToggle selected={days} onChange={setDays} />
    </div>
  )

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      units="USD"
      actions={chartActions}
      height={300}
    >
      <div style={{ height: 300 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
          >
            <defs>
              {displayTokens.map((token) => (
                <linearGradient
                  key={token}
                  id={`gradient-${token}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={tokenColors[token]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={tokenColors[token]}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: colors.textMuted }}
              tickFormatter={(v) => formatUSD(v)}
              width={70}
            />
            <Tooltip
              content={
                <CustomTooltip
                  allTokens={allTokens}
                  tokenColors={tokenColors}
                />
              }
              cursor={{
                stroke: colors.textMuted,
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
            {displayTokens.map((token) => (
              <Area
                key={token}
                type="monotone"
                dataKey={token}
                stackId="1"
                stroke={tokenColors[token]}
                strokeWidth={selectedToken ? 2 : 0.5}
                fill={`url(#gradient-${token})`}
                fillOpacity={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
