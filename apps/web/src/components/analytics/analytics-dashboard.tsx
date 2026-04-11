'use client'

import { MetricCard } from '@/components/dashboard/metric-card'
import { NpsGauge } from '@/components/dashboard/nps-gauge'
import { ResponseFeed } from '@/components/dashboard/response-feed'
import { NpsTrendChart } from './nps-trend-chart'
import { ResponseTrendChart } from './response-trend-chart'
import { ResponseHeatmap } from './response-heatmap'
import { SentimentPanel } from './sentiment-panel'
import type { TrendPoint, NpsTrendPoint, AnomalyResult } from '@/lib/analytics-queries'
import type { HeatmapCell } from './response-heatmap'
import type { SentimentSummary } from './sentiment-panel'

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
  responseTrend: TrendPoint[]
  npsTrend: NpsTrendPoint[]
  heatmapData: HeatmapCell[]
  anomalies: AnomalyResult[]
  sentimentSummary: SentimentSummary
}

export function AnalyticsDashboard({
  initialMetrics: m,
  initialResponses,
  orgId,
  responseTrend,
  npsTrend,
  heatmapData,
  anomalies,
  sentimentSummary,
}: AnalyticsDashboardProps) {
  const csatDisplay = m.csatAverage !== null ? `${m.csatAverage.toFixed(1)} / 5` : '—'
  const completionDisplay = m.completionRate !== null ? `${Math.round(m.completionRate)}%` : '—'

  return (
    <div className="space-y-6">
      {/* Anomaly alerts */}
      {anomalies.filter((a) => a.isAnomaly).map((a) => (
        <div key={a.metric} className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Anomaly detected</span> — {a.metric.replace('_', ' ')} today is{' '}
          <span className="font-medium">{a.current}</span> vs baseline of {a.baseline} (z={a.zScore})
        </div>
      ))}

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
          label="NPS responses"
          value={(m.promoters + m.passives + m.detractors).toLocaleString()}
          sub={`${m.promoters} P · ${m.passives} Pa · ${m.detractors} D`}
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
          <ResponseFeed initialResponses={initialResponses} orgId={orgId} />
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <h3 className="mb-3 text-sm font-semibold">Daily Responses (30d)</h3>
          <ResponseTrendChart data={responseTrend} />
        </div>
        <div className="rounded-lg border bg-background p-4">
          <h3 className="mb-3 text-sm font-semibold">NPS Trend — 7-day rolling (30d)</h3>
          <NpsTrendChart data={npsTrend} />
        </div>
      </div>

      {/* Response heatmap */}
      <div className="rounded-lg border bg-background p-4">
        <h3 className="mb-4 text-sm font-semibold">Response Activity — Hour × Day (90d)</h3>
        <ResponseHeatmap data={heatmapData} />
      </div>

      {/* AI Sentiment */}
      <SentimentPanel data={sentimentSummary} />
    </div>
  )
}
