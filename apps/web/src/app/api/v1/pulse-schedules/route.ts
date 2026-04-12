import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { z } from 'zod'

const WRITE_ROLES = ['owner', 'admin']

const CreateSchema = z.object({
  name:            z.string().min(1).max(100),
  survey_id:       z.string().uuid(),
  cron_expression: z.string().min(1),
  anonymity_mode:  z.boolean().default(true),
})

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('pulse_schedules')
    .select('id, name, cron_expression, is_active, anonymity_mode, last_sent_at, next_send_at, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!role || !WRITE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('pulse_schedules')
    .insert({
      organization_id: orgId,
      created_by: user.id,
      ...parsed.data,
    } as never)
    .select('id, name, cron_expression, is_active, anonymity_mode, last_sent_at, next_send_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
