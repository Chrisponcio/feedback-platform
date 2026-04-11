import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import {
  fetchDailyTrend,
  fetchNpsTrend,
  fetchHeatmapData,
  detectAnomalies,
} from '@/lib/analytics-queries'

export const metadata: Metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = (user?.app_metadata?.organization_id as string | undefined) ?? ''

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalResponses },
    { count: totalStarted },
    { data: rawNpsAnswers },
    { data: rawCsatAnswers },
    { data: rawFeed },
    responseTrend,
    npsTrend,
    heatmapData,
    anomalies,
  ] = await Promise.all([
    supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('is_complete', true)
      .gte('created_at', thirtyDaysAgo),

    supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('question_type', 'nps')
      .gte('created_at', thirtyDaysAgo)
      .not('value_numeric', 'is', null),

    supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('question_type', 'csat')
      .gte('created_at', thirtyDaysAgo)
      .not('value_numeric', 'is', null),

    supabase
      .from('responses')
      .select('id, created_at, channel, is_complete, surveys(title)')
      .eq('is_complete', true)
      .order('created_at', { ascending: false })
      .limit(20),

    fetchDailyTrend(supabase, 30),
    fetchNpsTrend(supabase, 30),
    fetchHeatmapData(supabase, 90),
    detectAnomalies(supabase),
  ])

  type NumericAnswer = { value_numeric: number | null }
  type FeedRow = {
    id: string; created_at: string; channel: string
    is_complete: boolean; surveys: { title: string } | null
  }

  const npsAnswers  = (rawNpsAnswers  as unknown as NumericAnswer[] | null) ?? []
  const csatAnswers = (rawCsatAnswers as unknown as NumericAnswer[] | null) ?? []
  const feedRows    = (rawFeed        as unknown as FeedRow[]       | null) ?? []

  const npsValues  = npsAnswers.map((a) => a.value_numeric).filter((v): v is number => v !== null)
  const promoters  = npsValues.filter((v) => v >= 9).length
  const passives   = npsValues.filter((v) => v >= 7 && v <= 8).length
  const detractors = npsValues.filter((v) => v <= 6).length
  const npsScore   = npsValues.length > 0
    ? Math.round(((promoters - detractors) / npsValues.length) * 100)
    : null

  const csatValues  = csatAnswers.map((a) => a.value_numeric).filter((v): v is number => v !== null)
  const csatAverage = csatValues.length > 0
    ? csatValues.reduce((s, v) => s + v, 0) / csatValues.length
    : null

  const completionRate =
    totalStarted && totalStarted > 0 && totalResponses !== null
      ? (totalResponses / totalStarted) * 100
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
          passives,
          detractors,
          csatAverage,
          completionRate,
          periodDays: 30,
        }}
        initialResponses={feedRows}
        orgId={orgId}
        responseTrend={responseTrend}
        npsTrend={npsTrend}
        heatmapData={heatmapData}
        anomalies={anomalies}
      />
    </div>
  )
}
