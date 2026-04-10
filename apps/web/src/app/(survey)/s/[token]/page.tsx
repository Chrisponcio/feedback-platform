import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SurveyRunner } from '@/components/survey/survey-runner'
import { BrandedSurveyShell } from '@/components/survey/branded-survey-shell'
import type { RunnerQuestion } from '@/components/survey/question-inputs'

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

  const dist = data as unknown as { surveys: { title: string } | null } | null
  return { title: dist?.surveys?.title ?? 'Feedback Survey' }
}

export default async function SurveyPage({ params, searchParams }: SurveyPageProps) {
  const { token } = await params
  const { lang } = await searchParams
  const supabase = createServiceRoleClient()

  const { data: distribution } = await supabase
    .from('survey_distributions')
    .select(`
      id,
      token,
      channel,
      surveys (
        id,
        title,
        description,
        status,
        branding,
        language,
        thank_you_message,
        redirect_url,
        questions (
          id,
          type,
          title,
          description,
          is_required,
          position,
          settings
        )
      )
    `)
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!distribution) notFound()

  type RawQuestion = {
    id: string; type: string; title: string; description: string | null
    is_required: boolean; position: number; settings: Record<string, unknown> | null
  }
  type RawSurvey = {
    id: string; title: string; description: string | null; status: string
    branding: Record<string, string>; language: string
    thank_you_message: string | null; redirect_url: string | null
    questions: RawQuestion[]
  }
  type RawDist = { id: string; token: string; channel: string; surveys: RawSurvey | null }

  const dist = distribution as unknown as RawDist
  const survey = dist.surveys

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

  const questions: RunnerQuestion[] = [...survey.questions].sort(
    (a, b) => a.position - b.position
  )

  const locale = lang ?? survey.language ?? 'en'

  return (
    <BrandedSurveyShell branding={survey.branding ?? {}}>
      <SurveyRunner
        survey={{
          id: survey.id,
          title: survey.title,
          description: survey.description,
          thank_you_message: survey.thank_you_message,
          redirect_url: survey.redirect_url,
          questions,
        }}
        distributionToken={dist.token}
        channel={dist.channel}
        locale={locale}
      />
    </BrandedSurveyShell>
  )
}
