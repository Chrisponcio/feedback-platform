import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { SurveyBuilder } from '@/components/builder/survey-builder'
import type { SurveySettings, QuestionType, BuilderQuestion } from '@/stores/builder-store'

export const metadata: Metadata = { title: 'Survey Builder' }

interface BuildPageProps {
  params: Promise<{ surveyId: string }>
}

export default async function BuildPage({ params }: BuildPageProps) {
  const { surveyId } = await params

  // Verify user is authenticated + has an org (the (dashboard) layout already
  // guards this, but we need the orgId here to scope the survey lookup).
  const authClient = await createServerClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) redirect('/login')
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) redirect('/login?error=no_org')

  // Use service-role for the fetch so we bypass RLS (avoids JWT-freshness
  // edge cases), but manually enforce org isolation via the .eq filter.
  const supabase = createServiceRoleClient()

  const { data: rawSurveyData, error: surveyError } = await supabase
    .from('surveys')
    .select('id, organization_id, title, language, thank_you_message, redirect_url, response_limit')
    .eq('id', surveyId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (surveyError) {
    console.error('[BuildPage] survey fetch failed:', surveyError)
    notFound()
  }
  if (!rawSurveyData) notFound()

  const { data: rawQuestions, error: questionsError } = await supabase
    .from('questions')
    .select('id, type, title, description, is_required, position, settings, logic')
    .eq('survey_id', surveyId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('position')

  if (questionsError) {
    console.error('[BuildPage] questions fetch failed:', questionsError)
  }

  type RawQuestion = {
    id: string
    type: string
    title: string
    description: string | null
    is_required: boolean
    position: number
    settings: Record<string, unknown> | null
    logic: import('@/lib/logic-evaluator').LogicConfig | null
  }

  type RawSurvey = {
    id: string
    title: string
    language: string
    thank_you_message: string | null
    redirect_url: string | null
    response_limit: number | null
    questions: RawQuestion[]
  }

  const survey = {
    ...(rawSurveyData as unknown as Omit<RawSurvey, 'questions'>),
    questions: (rawQuestions as unknown as RawQuestion[]) ?? [],
  } as RawSurvey

  const initialSettings: SurveySettings = {
    title: survey.title,
    language: survey.language,
    thank_you_message: survey.thank_you_message ?? 'Thank you for your feedback!',
    redirect_url: survey.redirect_url ?? '',
    response_limit: survey.response_limit,
  }

  const initialQuestions: BuilderQuestion[] = [...survey.questions]
    .sort((a, b) => a.position - b.position)
    .map((q) => {
      const s = q.settings ?? {}
      return {
        id: q.id,
        type: q.type as QuestionType,
        title: q.title,
        description: q.description ?? '',
        required: q.is_required,
        position: q.position,
        options: Array.isArray(s.options) ? (s.options as { id: string; label: string }[]) : [],
        scale_min: typeof s.scale_min === 'number' ? s.scale_min : undefined,
        scale_max: typeof s.scale_max === 'number' ? s.scale_max : undefined,
        logic: (q.logic as import('@/lib/logic-evaluator').LogicConfig | null) ?? null,
      }
    })

  // Fetch existing web_link distribution token (if any) — may be absent for a
  // newly-created survey, so use maybeSingle to avoid PGRST116 errors.
  const { data: distRow } = await supabase
    .from('survey_distributions')
    .select('token')
    .eq('survey_id', surveyId)
    .eq('organization_id', orgId)
    .eq('channel', 'web_link')
    .eq('is_active', true)
    .maybeSingle()

  const existingToken = distRow
    ? (distRow as unknown as { token: string }).token
    : null

  return (
    <SurveyBuilder
      surveyId={surveyId}
      initialSettings={initialSettings}
      initialQuestions={initialQuestions}
      existingDistributionToken={existingToken}
    />
  )
}
