'use server'

import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from './supabase/server'

const WRITE_ROLES = ['owner', 'admin', 'manager']

// Only these survey_type values are permitted by the surveys table CHECK constraint.
const ALLOWED_SURVEY_TYPES = new Set(['standard', 'pulse', 'kiosk', 'onboarding'])

/**
 * Create a new survey pre-populated from a template, then redirect to the builder.
 *
 * Uses the user-scoped client for the surveys INSERT so RLS is enforced
 * consistently with the subsequent build-page SELECT — avoids the case where
 * a service-role insert succeeds but the user's JWT org_id doesn't match and
 * the build page 404s on its own survey.
 */
export async function createSurveyFromTemplate(templateId: string) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !WRITE_ROLES.includes(role)) redirect('/surveys')

  const serviceClient = createServiceRoleClient()

  // Fetch template (service role — templates can be system-owned, not scoped to user)
  const { data: rawTemplate } = await serviceClient
    .from('survey_templates' as never)
    .select('id, name, survey_type, template_data')
    .eq('id', templateId)
    .or(`is_system.eq.true,organization_id.eq.${orgId}`)
    .single()

  if (!rawTemplate) redirect('/surveys')
  const template = rawTemplate as unknown as {
    id: string
    name: string
    survey_type: string
    template_data: unknown
  }

  type TemplateData = {
    settings?: {
      title?: string
      language?: string
      thank_you_message?: string
      redirect_url?: string
      response_limit?: number | null
    }
    questions?: {
      type: string
      title: string
      description: string | null
      is_required: boolean
      position: number
      settings: Record<string, unknown>
    }[]
  }

  const td = (template.template_data as unknown as TemplateData) ?? {}
  const settings = td.settings ?? {}

  // Coerce survey_type to a value allowed by the CHECK constraint on surveys.
  // Templates may use semantic types like 'nps'/'csat'/'mixed'/'event' for UI
  // display — those don't map 1:1 to the surveys.survey_type domain.
  const surveyType = ALLOWED_SURVEY_TYPES.has(template.survey_type)
    ? template.survey_type
    : 'standard'

  // Create survey via user-scoped client so RLS is enforced consistently with
  // the subsequent RLS-scoped SELECT on the build page.
  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .insert({
      organization_id: orgId,
      created_by: user.id,
      title: settings.title ?? template.name,
      language: settings.language ?? 'en',
      thank_you_message: settings.thank_you_message ?? 'Thank you for your feedback!',
      redirect_url: settings.redirect_url || null,
      response_limit: settings.response_limit ?? null,
      status: 'draft',
      survey_type: surveyType,
    } as never)
    .select('id')
    .single()

  if (surveyError || !survey) redirect('/surveys')

  const surveyId = (survey as unknown as { id: string }).id

  // Create questions via user-scoped client too — same RLS guarantees apply.
  if (td.questions && td.questions.length > 0) {
    await supabase.from('questions').insert(
      td.questions.map(
        (q) =>
          ({
            survey_id: surveyId,
            organization_id: orgId,
            type: q.type,
            title: q.title,
            description: q.description ?? null,
            is_required: q.is_required,
            position: q.position,
            settings: q.settings ?? {},
            logic: null,
          }) as never
      )
    )
  }

  redirect(`/surveys/${surveyId}/build`)
}
