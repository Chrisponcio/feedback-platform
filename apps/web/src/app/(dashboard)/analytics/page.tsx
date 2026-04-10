import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'

export const metadata: Metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const supabase = await createServerClient()

  // Fetch initial aggregate metrics for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ count: totalResponses }, { data: rawNpsAnswers }] = await Promise.all([
    supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('is_complete', true)
      .gte('created_at', thirtyDaysAgo),
    supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('question_type', 'nps')
      .gte('created_at', thirtyDaysAgo)
      .not('value_numeric', 'is', null),
  ])

  // question_type enum filter causes Supabase TS to infer `never` — cast via unknown
  const npsAnswers = rawNpsAnswers as unknown as Array<{ value_numeric: number | null }>

  // Calculate NPS score
  const npsValues = (npsAnswers ?? [])
    .map((a) => a.value_numeric)
    .filter((v): v is number => v !== null)
  const promoters = npsValues.filter((v) => v >= 9).length
  const detractors = npsValues.filter((v) => v <= 6).length
  const npsScore =
    npsValues.length > 0
      ? Math.round(((promoters - detractors) / npsValues.length) * 100)
      : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Real-time feedback insights across all surveys</p>
      </div>
      <AnalyticsDashboard
        initialMetrics={{
          totalResponses: totalResponses ?? 0,
          npsScore,
          promoters,
          detractors,
          periodDays: 30,
        }}
      />
    </div>
  )
}
