'use client'

import { MetricCard } from '@/components/dashboard/metric-card'
import { NpsGauge } from '@/components/dashboard/nps-gauge'
import { ResponseFeed } from '@/components/dashboard/response-feed'

interface FeedResponse {
  id: string
  created_at: string
  channel: string
  is_complete: boolean
  surveys: { title: string } | null
}

interface AnalyticsMetrics {
  totalResponses: number
  npsScore: number | null
  promoters: number
  passives: number
  detractors: number
  csatAverage: number | null
  completionRate: number | null
  periodDays: number
}

interface AnalyticsDashboardProps {
  initialMetrics: AnalyticsMetrics
  initialResponses: FeedResponse[]
  orgId: string
}

export function AnalyticsDashboard({
  initialMetrics: m,
  initialResponses,
  orgId,
}: AnalyticsDashboardProps) {
  const csatDisplay = m.csatAverage !== null
    ? `${m.csatAverage.toFixed(1)} / 5`
    : '—'

  const completionDisplay = m.completionRate !== null
    ? `${Math.round(m.completionRate)}%`
    : '—'

  return (
    <div className="space-y-6">
      {/* Top metrics row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={`Responses (${m.periodDays}d)`}
          value={m.totalResponses.toLocaleString()}
          sub="completed surveys"
        />
        <MetricCard
          label="CSAT Average"
          value={csatDisplay}
          sub={m.csatAverage !== null ? 'out of 5.0' : 'no data yet'}
          accent={
            m.csatAverage === null ? 'default'
            : m.csatAverage >= 4   ? 'green'
            : m.csatAverage >= 3   ? 'amber'
            : 'red'
          }
        />
        <MetricCard
          label="Completion rate"
          value={completionDisplay}
          sub="of started surveys"
          accent={
            m.completionRate === null ? 'default'
            : m.completionRate >= 70  ? 'green'
            : m.completionRate >= 40  ? 'amber'
            : 'red'
          }
        />
        <MetricCard
          label="Period"
          value={`${m.periodDays}d`}
          sub="last 30 days"
        />
      </div>

      {/* NPS gauge + response feed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <NpsGauge
          score={m.npsScore}
          promoters={m.promoters}
          passives={m.passives}
          detractors={m.detractors}
          total={m.promoters + m.passives + m.detractors}
        />
        <div className="lg:col-span-2">
          <ResponseFeed
            initialResponses={initialResponses}
            orgId={orgId}
          />
        </div>
      </div>
    </div>
  )
}
