'use client'

/**
 * ResponseHeatmap — Hour × Day CSS grid
 *
 * Rows: hours 0–23
 * Cols: days Sun–Sat
 * Cell color intensity driven by response count relative to max.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12
  const ampm = i < 12 ? 'am' : 'pm'
  return i === 0 ? '12am' : i === 12 ? '12pm' : `${h}${ampm}`
})

export interface HeatmapCell {
  day: number   // 0 = Sunday
  hour: number  // 0–23
  count: number
}

interface ResponseHeatmapProps {
  data: HeatmapCell[]
  accentColor?: string
}

export function ResponseHeatmap({ data, accentColor = '#6366f1' }: ResponseHeatmapProps) {
  // Build lookup map
  const map = new Map<string, number>()
  let maxCount = 0
  for (const cell of data) {
    const key = `${cell.day}-${cell.hour}`
    map.set(key, cell.count)
    if (cell.count > maxCount) maxCount = cell.count
  }

  function cellCount(day: number, hour: number) {
    return map.get(`${day}-${hour}`) ?? 0
  }

  function opacity(count: number) {
    if (maxCount === 0 || count === 0) return 0.05
    return 0.1 + (count / maxCount) * 0.85
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-max" style={{ gridTemplateColumns: `auto repeat(7, 2.25rem)` }}>
        {/* Header row */}
        <div className="pr-2" />
        {DAYS.map((d) => (
          <div key={d} className="pb-1.5 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}

        {/* Hour rows */}
        {HOURS.map((label, hour) => (
          <>
            <div key={`label-${hour}`} className="flex items-center pr-2 text-right text-xs text-muted-foreground" style={{ height: '1.75rem' }}>
              {hour % 3 === 0 ? label : ''}
            </div>
            {DAYS.map((_, day) => {
              const count = cellCount(day, hour)
              return (
                <div
                  key={`${day}-${hour}`}
                  title={`${DAYS[day]} ${label}: ${count} response${count !== 1 ? 's' : ''}`}
                  className="m-0.5 cursor-default rounded-sm transition-opacity"
                  style={{
                    height: '1.5rem',
                    background: accentColor,
                    opacity: opacity(count),
                  }}
                />
              )
            })}
          </>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        {[0.05, 0.25, 0.5, 0.75, 0.95].map((o) => (
          <div
            key={o}
            className="h-3.5 w-5 rounded-sm"
            style={{ background: accentColor, opacity: o }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
