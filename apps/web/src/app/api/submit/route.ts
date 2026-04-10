import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'

const answerSchema = z.object({
  question_id: z.string().uuid(),
  question_type: z.string(),
  value_numeric: z.number().nullable().optional(),
  value_text: z.string().nullable().optional(),
  value_boolean: z.boolean().nullable().optional(),
  value_json: z.unknown().nullable().optional(),
})

const submitSchema = z.object({
  distribution_token: z.string().min(1),
  session_id: z.string().uuid(),
  answers: z.array(answerSchema).min(1),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  language: z.string().default('en'),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 422 })
  }

  const { distribution_token, session_id, answers, started_at, completed_at, language, metadata } =
    parsed.data

  const supabase = createServiceRoleClient()

  // Validate the distribution token
  const { data: distribution } = await supabase
    .from('survey_distributions')
    .select('id, survey_id, organization_id, channel, is_active')
    .eq('token', distribution_token)
    .single()

  if (!distribution || !distribution.is_active) {
    return NextResponse.json({ error: 'Invalid or inactive survey' }, { status: 404 })
  }

  // Validate survey is still active
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, status, ends_at, response_limit')
    .eq('id', distribution.survey_id)
    .single()

  if (!survey || survey.status !== 'active') {
    return NextResponse.json({ error: 'Survey is not accepting responses' }, { status: 409 })
  }

  if (survey.ends_at && new Date(survey.ends_at) < new Date()) {
    return NextResponse.json({ error: 'Survey has expired' }, { status: 409 })
  }

  // Calculate duration
  const durationSeconds = Math.round(
    (new Date(completed_at).getTime() - new Date(started_at).getTime()) / 1000
  )

  // Detect device type from User-Agent
  const ua = request.headers.get('user-agent') ?? ''
  const deviceType = /tablet|ipad/i.test(ua)
    ? 'tablet'
    : /mobile|android|iphone/i.test(ua)
      ? 'mobile'
      : 'desktop'

  // Hash IP for dedup (never store raw)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  let ipHash: string | null = null
  if (ip) {
    const encoder = new TextEncoder()
    const data = encoder.encode(ip)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    ipHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Idempotent insert — duplicate session_id is a no-op
  const { data: response, error: responseError } = await supabase
    .from('responses')
    .upsert(
      {
        survey_id: distribution.survey_id,
        organization_id: distribution.organization_id,
        distribution_id: distribution.id,
        is_anonymous: true,
        is_complete: true,
        started_at,
        completed_at,
        duration_seconds: durationSeconds,
        channel: distribution.channel,
        device_type: deviceType,
        session_id,
        language,
        ip_hash: ipHash,
        metadata: metadata ?? {},
      },
      { onConflict: 'session_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (responseError || !response) {
    console.error('Response insert error:', responseError)
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
  }

  // Insert answers
  const answerRows = answers.map((a) => ({
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

  const { error: answersError } = await supabase
    .from('response_answers')
    .upsert(answerRows, { onConflict: 'response_id,question_id', ignoreDuplicates: true })

  if (answersError) {
    console.error('Answers insert error:', answersError)
    // Response was saved; answers partial failure is non-fatal but logged
  }

  // Increment distribution response count
  await supabase.rpc('increment_distribution_count', { dist_id: distribution.id })

  return NextResponse.json({ success: true, response_id: response.id }, { status: 201 })
}
