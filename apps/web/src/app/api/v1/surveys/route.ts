import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/surveys
 * List surveys for the authenticated organization.
 *
 * Query params:
 *   status   — filter by status (draft|active|paused|archived)
 *   limit    — max results (default 50, max 100)
 *   offset   — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabase = createServiceRoleClient()

  let query = supabase
    .from('surveys')
    .select('id, title, status, survey_type, language, created_at, updated_at', { count: 'exact' })
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status as 'draft' | 'active' | 'paused' | 'archived' | 'closed')

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    meta: { total: count ?? 0, limit, offset },
  })
}
