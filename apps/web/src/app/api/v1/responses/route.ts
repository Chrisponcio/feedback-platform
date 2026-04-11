import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/responses
 * List survey responses for the authenticated organization.
 *
 * Query params:
 *   survey_id   — filter by survey UUID
 *   is_complete — filter by completion (true|false)
 *   since       — ISO timestamp lower bound on created_at
 *   limit       — max results (default 50, max 100)
 *   offset      — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const surveyId   = searchParams.get('survey_id')
  const isComplete = searchParams.get('is_complete')
  const since      = searchParams.get('since')
  const limit      = Math.min(parseInt(searchParams.get('limit')  ?? '50', 10), 100)
  const offset     = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabase = createServiceRoleClient()

  // Join to surveys to enforce org scoping
  let query = supabase
    .from('responses')
    .select(
      `id, session_id, survey_id, distribution_token, channel,
       language, is_complete, started_at, completed_at, created_at,
       surveys!inner(organization_id)`,
      { count: 'exact' }
    )
    .eq('surveys.organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (surveyId)   query = query.eq('survey_id', surveyId)
  if (since)      query = query.gte('created_at', since)
  if (isComplete !== null) {
    query = query.eq('is_complete', isComplete === 'true')
  }

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Strip the joined surveys column from the response payload
  type RawRow = Record<string, unknown> & { surveys: unknown }
  const rows = (data as unknown as RawRow[] | null) ?? []
  const cleaned = rows.map(({ surveys: _surveys, ...rest }) => rest)

  return NextResponse.json({
    data: cleaned,
    meta: { total: count ?? 0, limit, offset },
  })
}
