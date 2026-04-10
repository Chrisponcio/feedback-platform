import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SurveyRunner } from '@/components/survey/survey-runner'
import { BrandedSurveyShell } from '@/components/survey/branded-survey-shell'

interface SurveyPageProps {
  params: Promise<{ token: string }>
  searchParams: Promise<{ lang?: string }>
}

export async function generateMetadata({ params }: SurveyPageProps) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  const { data } = await supabase
    .from('survey_distributions')
    .select('surveys(title)')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  // Joined select causes Supabase TS to infer `never` — cast via unknown
  const dist = data as unknown as { surveys: { title: string } | null } | null
  const title = dist?.surveys?.title ?? 'Feedback Survey'
  return { title }
}

export default async function SurveyPage({ params, searchParams }: SurveyPageProps) {
  const { token } = await params
  const { lang } = await searchParams
  const supabase = createServiceRoleClient()

  // Validate the distribution token and load survey with questions
  const { data: distribution } = await supabase
    .from('survey_distributions')
    .select(`
      id,
      channel,
      config,
      surveys (
        id,
        title,
        description,
        status,
        branding,
        settings,
        language,
        thank_you_message,
        redirect_url,
        ends_at,
        response_limit,
        questions (
          id,
          type,
          title,
          description,
          is_required,
          position,
          settings,
          logic
        )
      )
    `)
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!distribution) notFound()

  // Joined select causes Supabase TS to infer `never` — cast via unknown
  type DistributionData = {
    id: string; channel: string; config: unknown
    surveys: (Record<string, unknown> & { questions: Array<{ position: number }> }) | null
  }
  const dist2 = distribution as unknown as DistributionData
  const survey = dist2.surveys
  if (!survey || survey.status !== 'active') {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Survey Unavailable</h1>
          <p className="mt-2 text-muted-foreground">
            This survey is no longer accepting responses.
          </p>
        </div>
      </div>
    )
  }

  // Sort questions by position
  const questions = (
    (survey.questions as Array<{ position: number }> | null) ?? []
  ).sort((a, b) => a.position - b.position)

  const locale = lang ?? (survey.language as string) ?? 'en'
  const branding = (survey.branding as Record<string, string>) ?? {}

  return (
    <BrandedSurveyShell branding={branding}>
      <SurveyRunner
        survey={{ ...survey, questions }}
        distributionId={dist2.id}
        channel={dist2.channel}
        locale={locale}
      />
    </BrandedSurveyShell>
  )
}
