import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/kiosk/bundle?token={distributionToken}
 *
 * Returns a complete, cacheable survey bundle for the kiosk.
 * Includes survey metadata, questions, and branding.
 *
 * Responses:
 *   200 — bundle JSON with ETag for conditional requests
 *   304 — Not Modified (when If-None-Match matches current ETag)
 *   404 — distribution not found or inactive
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Fetch distribution
  const { data: distribution } = await supabase
    .from('survey_distributions')
    .select('id, token, survey_id, organization_id, is_active')
    .eq('token', token)
    .eq('channel', 'kiosk')
    .single()

  if (!distribution || !distribution.is_active) {
    return NextResponse.json({ error: 'Kiosk not found' }, { status: 404 })
  }

  const dist = distribution as unknown as {
    id: string
    token: string
    survey_id: string
    organization_id: string
    is_active: boolean
  }

  // Fetch survey
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, title, thank_you_message, redirect_url, status, branding')
    .eq('id', dist.survey_id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Survey not active' }, { status: 404 })
  }

  const s = survey as unknown as {
    id: string
    title: string
    thank_you_message: string
    redirect_url: string | null
    branding: Record<string, unknown> | null
  }

  // Fetch questions
  const { data: questionsRaw } = await supabase
    .from('questions')
    .select('id, type, title, description, is_required, position, settings')
    .eq('survey_id', dist.survey_id)
    .is('deleted_at', null)
    .order('position', { ascending: true })

  const questions = (questionsRaw ?? []) as unknown as Array<{
    id: string
    type: string
    title: string
    description: string | null
    is_required: boolean
    position: number
    settings: Record<string, unknown> | null
  }>

  // Fetch org branding (name + logo)
  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url')
    .eq('id', dist.organization_id)
    .single()

  const orgData = org as unknown as { name: string; logo_url: string | null } | null

  const bundle = {
    survey: {
      id: s.id,
      title: s.title,
      thank_you_message: s.thank_you_message ?? 'Thank you for your feedback!',
      redirect_url: s.redirect_url,
      branding: {
        ...(s.branding ?? {}),
        org_name: orgData?.name,
        logo_url: orgData?.logo_url ?? (s.branding as Record<string, unknown> | null)?.logo_url,
      },
    },
    distribution: {
      id: dist.id,
      token: dist.token,
    },
    questions,
  }

  // ETag based on survey + question count for conditional caching
  const etag = `"${dist.survey_id}-${questions.length}"`
  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 })
  }

  return NextResponse.json(bundle, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'ETag': etag,
    },
  })
}
