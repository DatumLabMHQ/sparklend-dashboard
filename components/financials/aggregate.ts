import { Period } from "./period-toggle"

interface DailyEntry {
  date: number
  [key: string]: number
}

// Week key = ISO Monday of that week, formatted as e.g. "Aug 12 '26".
// Previously returned "W33 2026" which forced users to decode ISO week
// numbers. Grouping still works because Mondays are unique per week.
function getWeekKey(ts: number): string {
  const d = new Date(ts * 1000)
  const day = d.getUTCDay()
  const mondayOffset = (day + 6) % 7
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset)
  )
  return (
    monday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }) + ` '${String(monday.getUTCFullYear()).slice(2)}`
  )
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
  valueKeys: string[],
  opts: { dropIncomplete?: boolean } = {}
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

  // Default: KEEP the current partial period. Callers can still opt into the
  // old "drop the incomplete bar" behaviour by passing dropIncomplete: true.
  // Flag the current bucket as `isIncomplete` so the chart can style it
  // differently (dashed border, lower opacity) — users are surprised when
  // "August" is missing on Aug 18, and hiding the bar wholesale loses the
  // signal that the month is in-flight.
  const nowKey = getKey(Math.floor(Date.now() / 1000))
  let output = order
  if (opts.dropIncomplete === true && order.length > 0) {
    if (order[order.length - 1] === nowKey) {
      output = order.slice(0, -1)
    }
  }

  return output.map((key) => ({
    label: key,
    isIncomplete: key === nowKey,
    ...groups.get(key)!,
  }))
}
