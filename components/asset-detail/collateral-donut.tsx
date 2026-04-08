"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts"
import { useState, useMemo } from "react"
import { formatUSD, formatPercent, getTokenColor, getTokenName } from "@/lib/utils"
import { ChartCard } from "@/components/chart-card"
import { useThemeColors } from "@/components/theme-provider"

interface DonutEntry {
  symbol: string
  valueUSD: number
  percentage: number
}

interface CollateralDonutProps {
  title: string
  subtitle: string
  data: DonutEntry[]
}

function createActiveShapeRenderer(textPrimary: string, textSecondary: string) {
  return function renderActiveShape(props: any) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } =
      props

    return (
      <g>
        <text x={cx} y={cy - 8} textAnchor="middle" fill={textPrimary} fontSize={13} fontWeight={600}>
          {getTokenName(payload.symbol)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill={textSecondary} fontSize={11}>
          {formatPercent(payload.percentage)}
        </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
    )
  }
}

export function CollateralDonut({ title, subtitle, data }: CollateralDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const colors = useThemeColors()
  const renderActiveShape = useMemo(
    () => createActiveShapeRenderer(colors.textPrimary, colors.textSecondary),
    [colors]
  )

  if (!data || data.length === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle} heightClass="h-auto">
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-xs text-text-muted">Coming soon</p>
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title={title} subtitle={subtitle} heightClass="h-auto">

      <div className="flex items-start gap-6">
        {/* Donut */}
        <div className="w-[180px] h-[180px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="percentage"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={1}
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.symbol} fill={getTokenColor(i)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list */}
        <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto">
          {data.map((entry, i) => (
            <div
              key={entry.symbol}
              className="flex items-center justify-between gap-2"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getTokenColor(i) }}
                />
                <span className="text-xs text-text-secondary">
                  {getTokenName(entry.symbol)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-text-primary">
                  {formatUSD(entry.valueUSD)}
                </span>
                <span className="text-[10px] text-text-muted w-10 text-right">
                  {formatPercent(entry.percentage, 1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}
