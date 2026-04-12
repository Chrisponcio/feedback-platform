import type { Metadata } from 'next'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { SurveyList } from '@/components/surveys/survey-list'

export const metadata: Metadata = { title: 'Surveys' }

export default async function SurveysPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = (user?.app_metadata?.role as string | undefined) ?? 'viewer'

  const serviceClient = createServiceRoleClient()

  const [{ data: rawSurveys }, { data: templates }] = await Promise.all([
    supabase
      .from('surveys')
      .select('id, title, status, survey_type, language, created_at, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),

    serviceClient
      .from('survey_templates')
      .select('id, name, description, survey_type, is_system')
      .or(`is_system.eq.true,organization_id.eq.${user?.app_metadata?.organization_id ?? '00000000-0000-0000-0000-000000000000'}`)
      .order('is_system', { ascending: false })
      .order('name'),
  ])

  type SurveyRow = {
    id: string; title: string; status: string; survey_type: string
    language: string; created_at: string; updated_at: string
  }
  type TemplateRow = { id: string; name: string; description: string | null; survey_type: string; is_system: boolean }

  const surveys = rawSurveys as unknown as SurveyRow[]
  const templateRows = (templates as unknown as TemplateRow[] | null) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Surveys</h1>
          <p className="text-muted-foreground">Create and manage your feedback surveys</p>
        </div>
      </div>
      <SurveyList
        surveys={surveys ?? []}
        templates={templateRows}
        canCreate={['owner', 'admin', 'manager'].includes(role)}
      />
    </div>
  )
}
