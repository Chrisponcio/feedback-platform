import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SignageDisplay } from '@/components/signage/signage-display'

export const metadata: Metadata = { title: 'Live Signage — Pulse' }

interface Props {
  params: Promise<{ token: string }>
}

export default async function SignagePage({ params }: Props) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  const { data: dist } = await supabase
    .from('survey_distributions')
    .select('id, survey_id, organization_id, config, surveys(title)')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!dist) notFound()

  type DistRow = {
    id: string
    survey_id: string
    organization_id: string
    config: Record<string, unknown> | null
    signage_config?: Record<string, unknown> | null
    surveys: { title: string } | null
  }
  const row = dist as unknown as DistRow

  const orgId = row.organization_id
  const surveyId = row.survey_id
  const surveyTitle = row.surveys?.title ?? 'Survey'
  const signageConfig = (row.signage_config as {
    metric?: string
    refresh_interval?: number
    show_trend?: boolean
    theme?: string
  }) ?? {}

  // Fetch initial metrics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { count: totalResponses },
    { data: npsAnswers },
    { data: csatAnswers },
  ] = await Promise.all([
    supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', surveyId)
      .eq('is_complete', true)
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
  ])

  type NumericRow = { value_numeric: number }
  const npsValues = ((npsAnswers as unknown as NumericRow[]) ?? []).map((a) => a.value_numeric)
  const csatValues = ((csatAnswers as unknown as NumericRow[]) ?? []).map((a) => a.value_numeric)

  const promoters = npsValues.filter((v) => v >= 9).length
  const detractors = npsValues.filter((v) => v <= 6).length
  const npsScore = npsValues.length > 0
    ? Math.round(((promoters - detractors) / npsValues.length) * 100)
    : null

  const csatAverage = csatValues.length > 0
    ? Math.round((csatValues.reduce((s, v) => s + v, 0) / csatValues.length) * 10) / 10
    : null

  return (
    <SignageDisplay
      surveyTitle={surveyTitle}
      orgId={orgId}
      surveyId={surveyId}
      initialMetrics={{
        totalResponses: totalResponses ?? 0,
        npsScore,
        csatAverage,
        promoters,
        passives: npsValues.filter((v) => v >= 7 && v <= 8).length,
        detractors,
      }}
      config={{
        metric: signageConfig.metric ?? 'nps',
        refreshInterval: signageConfig.refresh_interval ?? 5,
        showTrend: signageConfig.show_trend ?? true,
        theme: signageConfig.theme ?? 'dark',
      }}
    />
  )
}
