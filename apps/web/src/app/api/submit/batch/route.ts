import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Batch submission endpoint for kiosk offline sync.
 * Authenticated via the distribution token in the Authorization header.
 * Each response is idempotent — duplicate session_ids are safely ignored.
 */

const answerSchema = z.object({
  question_id: z.string().uuid(),
  question_type: z.string(),
  value_numeric: z.number().nullable().optional(),
  value_text: z.string().nullable().optional(),
  value_boolean: z.boolean().nullable().optional(),
  value_json: z.unknown().nullable().optional(),
})

const pendingResponseSchema = z.object({
  session_id: z.string().uuid(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  language: z.string().default('en'),
  answers: z.array(answerSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
})

const batchSchema = z.object({
  responses: z.array(pendingResponseSchema).min(1).max(100),
})

export async function POST(request: NextRequest) {
  // Validate distribution token from Authorization header
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = createServiceRoleClient()

  // Validate the distribution token
  const { data: distribution } = await supabase
    .from('survey_distributions')
    .select('id, survey_id, organization_id, channel, is_active')
    .eq('token', token)
    .single()

  if (!distribution) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const results: Array<{
    session_id: string
    status: 'created' | 'duplicate' | 'error'
    response_id?: string
    error?: string
  }> = []

  for (const pending of parsed.data.responses) {
    const durationSeconds = Math.round(
      (new Date(pending.completed_at).getTime() - new Date(pending.started_at).getTime()) / 1000
    )

    const { data: response, error } = await supabase
      .from('responses')
      .upsert(
        {
          survey_id: distribution.survey_id,
          organization_id: distribution.organization_id,
          distribution_id: distribution.id,
          is_anonymous: true,
          is_complete: true,
          started_at: pending.started_at,
          completed_at: pending.completed_at,
          duration_seconds: durationSeconds,
          channel: distribution.channel,
          device_type: 'kiosk',
          session_id: pending.session_id,
          language: pending.language,
          metadata: pending.metadata ?? {},
        },
        { onConflict: 'session_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (error || !response) {
      results.push({ session_id: pending.session_id, status: 'error', error: error?.message })
      continue
    }

    // Upsert answers
    const answerRows = pending.answers.map((a) => ({
      response_id: response.id,
      question_id: a.question_id,
      organization_id: distribution.organization_id,
      survey_id: distribution.survey_id,
      question_type: a.question_type,
      value_numeric: a.value_numeric ?? null,
      value_text: a.value_text ?? null,
      value_boolean: a.value_boolean ?? null,
      value_json: (a.value_json as object | null) ?? null,
    }))

    await supabase
      .from('response_answers')
      .upsert(answerRows, { onConflict: 'response_id,question_id', ignoreDuplicates: true })

    results.push({ session_id: pending.session_id, status: 'created', response_id: response.id })
  }

  return NextResponse.json({ results }, { status: 207 })
}
