import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { z } from 'zod'

const workflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  survey_id: z.string().uuid().optional().nullable(),
  trigger_type: z.enum([
    'nps_detractor', 'nps_passive', 'nps_promoter',
    'csat_low', 'csat_high',
    'keyword_match', 'sentiment_negative',
    'response_created',
  ]),
  condition: z.record(z.unknown()).default({}),
  action_type: z.enum([
    'zendesk_ticket', 'slack_message', 'email_notification',
    'webhook', 'tag_response',
  ]),
  action_config: z.record(z.unknown()).default({}),
})

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const service = createServiceRoleClient()
  const { data, error } = await (service
    .from('workflow_triggers' as never)
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: unknown; error: { message: string } | null }>)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !['owner', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = workflowSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const service = createServiceRoleClient()
  const { data, error } = await (service
    .from('workflow_triggers' as never)
    .insert({ ...parsed.data, organization_id: orgId } as never)
    .select()
    .single() as unknown as Promise<{ data: unknown; error: { message: string } | null }>)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
