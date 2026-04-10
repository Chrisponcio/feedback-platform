'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from './supabase/server'
import type { BuilderQuestion, SurveySettings } from '@/stores/builder-store'

const settingsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  language: z.string().min(2).max(10),
  thank_you_message: z.string().max(500),
  redirect_url: z.string().url().or(z.literal('')),
  response_limit: z.number().int().positive().nullable(),
})

// ── Create a new blank survey ──────────────────────────────────────────────────

export async function createSurvey() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return { error: 'No organization found' }

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      organization_id: orgId,
      title: 'Untitled Survey',
      survey_type: 'standard',
      status: 'draft',
      language: 'en',
      thank_you_message: 'Thank you for your feedback!',
      created_by: user.id,
    } as never)
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create survey' }

  const row = data as unknown as { id: string }
  return { surveyId: row.id }
}

// ── Save survey settings + questions ──────────────────────────────────────────

export async function saveSurvey(
  surveyId: string,
  settings: SurveySettings,
  questions: BuilderQuestion[]
) {
  const parsed = settingsSchema.safeParse(settings)
  if (!parsed.success) return { error: 'Invalid settings' }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return { error: 'No organization found' }

  // Update survey row
  const { error: surveyError } = await supabase
    .from('surveys')
    .update({
      title: parsed.data.title,
      language: parsed.data.language,
      thank_you_message: parsed.data.thank_you_message,
      redirect_url: parsed.data.redirect_url || null,
      response_limit: parsed.data.response_limit,
    } as never)
    .eq('id', surveyId)
    .is('deleted_at', null)

  if (surveyError) return { error: surveyError.message }

  const serviceClient = createServiceRoleClient()

  // Delete questions removed from the builder
  const existingIds = questions
    .filter((q) => !q.id.startsWith('new-'))
    .map((q) => q.id)

  if (existingIds.length > 0) {
    await serviceClient
      .from('questions')
      .delete()
      .eq('survey_id', surveyId)
      .not('id', 'in', `(${existingIds.join(',')})`)
      .is('deleted_at', null)
  } else {
    await serviceClient
      .from('questions')
      .delete()
      .eq('survey_id', surveyId)
      .is('deleted_at', null)
  }

  // Upsert all questions
  if (questions.length > 0) {
    const rows = questions.map((q) => ({
      ...(q.id.startsWith('new-') ? {} : { id: q.id }),
      survey_id: surveyId,
      organization_id: orgId,
      type: q.type,
      title: q.title,
      description: q.description || null,
      is_required: q.required,
      position: q.position,
      logic: null,
      settings: {
        ...(q.type === 'multiple_choice' && { options: q.options }),
        ...(q.type === 'star_rating' && {
          scale_min: q.scale_min ?? 1,
          scale_max: q.scale_max ?? 5,
        }),
      },
    }))

    const { error: questionsError } = await serviceClient
      .from('questions')
      .upsert(rows as never[], { onConflict: 'id' })

    if (questionsError) return { error: questionsError.message }
  }

  revalidatePath(`/surveys/${surveyId}/build`)
  return { ok: true }
}
