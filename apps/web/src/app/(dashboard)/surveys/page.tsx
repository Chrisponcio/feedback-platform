import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { SurveyList } from '@/components/surveys/survey-list'

export const metadata: Metadata = { title: 'Surveys' }

export default async function SurveysPage() {
  const supabase = await createServerClient()

  const { data: rawSurveys } = await supabase
    .from('surveys')
    .select('id, title, status, survey_type, language, created_at, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  type SurveyRow = {
    id: string; title: string; status: string; survey_type: string
    language: string; created_at: string; updated_at: string
  }
  const surveys = rawSurveys as unknown as SurveyRow[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Surveys</h1>
          <p className="text-muted-foreground">Create and manage your feedback surveys</p>
        </div>
      </div>
      <SurveyList surveys={surveys ?? []} />
    </div>
  )
}
