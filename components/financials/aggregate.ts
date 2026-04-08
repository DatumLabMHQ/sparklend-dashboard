import { Period } from "./period-toggle"

interface DailyEntry {
  date: number
  [key: string]: number
}

function getWeekKey(ts: number): string {
  const d = new Date(ts * 1000)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `W${week} ${d.getFullYear()}`
}

function getMonthKey(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function getQuarterKey(ts: number): string {
  const d = new Date(ts * 1000)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

function getYearKey(ts: number): string {
  return new Date(ts * 1000).getFullYear().toString()
}

function getDayLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function aggregateData(
  daily: DailyEntry[],
  period: Period,
  valueKeys: string[]
): Array<Record<string, any>> {
  if (period === "D") {
    return daily.map((d) => {
      const entry: any = {
        label: getDayLabel(d.date),
      }
      valueKeys.forEach((k) => {
        entry[k] = d[k] || 0
      })
      return entry
    })
  }

  const getKey =
    period === "W"
      ? getWeekKey
      : period === "M"
        ? getMonthKey
        : period === "Q"
          ? getQuarterKey
          : getYearKey

  const groups = new Map<string, Record<string, number>>()
  const order: string[] = []

  for (const d of daily) {
    const key = getKey(d.date)
    if (!groups.has(key)) {
      groups.set(key, {})
      order.push(key)
    }
    const g = groups.get(key)!
    valueKeys.forEach((k) => {
      g[k] = (g[k] || 0) + (d[k] || 0)
    })
  }

  return order.map((key) => ({
    label: key,
    ...groups.get(key)!,
  }))
}
