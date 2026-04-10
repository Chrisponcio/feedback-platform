'use client'

interface AnalyticsMetrics {
  totalResponses: number
  npsScore: number | null
  promoters: number
  detractors: number
  periodDays: number
}

interface AnalyticsDashboardProps {
  initialMetrics: AnalyticsMetrics
}

export function AnalyticsDashboard({ initialMetrics }: AnalyticsDashboardProps) {
  return (
    <div className="rounded-lg border p-6 text-center text-muted-foreground">
      Analytics dashboard — {initialMetrics.totalResponses} responses in last{' '}
      {initialMetrics.periodDays} days — coming in Phase 1
    </div>
  )
}
