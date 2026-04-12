import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !['owner', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>
  const allowed = ['name', 'description', 'trigger_type', 'condition', 'action_type', 'action_config', 'is_active', 'survey_id']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 422 })
  }

  const service = createServiceRoleClient()
  const { data, error } = await (service
    .from('workflow_triggers' as never)
    .update(updates as never)
    .eq('id', id)
    .eq('organization_id', orgId)
    .select()
    .single() as unknown as Promise<{ data: unknown; error: { message: string } | null }>)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !['owner', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceRoleClient()
  const { error } = await (service
    .from('workflow_triggers' as never)
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId) as unknown as Promise<{ error: { message: string } | null }>)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
