'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface NpsGaugeProps {
  score: number | null
  promoters: number
  passives: number
  detractors: number
  total: number
}

export function NpsGauge({ score, promoters, passives, detractors, total }: NpsGaugeProps) {
  const data = [
    { name: 'Detractors', value: detractors, color: '#ef4444' },
    { name: 'Passives',   value: passives,   color: '#f59e0b' },
    { name: 'Promoters',  value: promoters,  color: '#10b981' },
  ]

  // Always render the gauge even with no data — show empty arcs
  const chartData = total > 0 ? data : [
    { name: 'Detractors', value: 1, color: '#e5e7eb' },
    { name: 'Passives',   value: 1, color: '#e5e7eb' },
    { name: 'Promoters',  value: 1, color: '#e5e7eb' },
  ]

  const scoreColor =
    score === null ? 'text-muted-foreground'
    : score >= 50  ? 'text-emerald-600'
    : score >= 0   ? 'text-amber-600'
    : 'text-red-600'

  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">NPS Score</p>
      <div className="relative mt-2 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="90%"
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Score overlay */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <span className={`text-4xl font-bold tracking-tight ${scoreColor}`}>
            {score !== null ? (score > 0 ? `+${score}` : score) : '—'}
          </span>
          <span className="text-xs text-muted-foreground">out of 100</span>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="font-semibold text-emerald-600">{promoters}</div>
            <div className="text-muted-foreground">Promoters</div>
          </div>
          <div>
            <div className="font-semibold text-amber-600">{passives}</div>
            <div className="text-muted-foreground">Passives</div>
          </div>
          <div>
            <div className="font-semibold text-red-600">{detractors}</div>
            <div className="text-muted-foreground">Detractors</div>
          </div>
        </div>
      )}
    </div>
  )
}
