import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { WEBHOOK_EVENTS } from '@/lib/webhook-events'

const WebhookSchema = z.object({
  name:   z.string().min(1).max(100),
  url:    z.string().url(),
  secret: z.string().min(8).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
})

/**
 * GET /api/v1/webhooks — list webhooks for the org
 */
export async function GET(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('outbound_webhooks')
    .select('id, name, url, events, is_active, failure_count, last_triggered_at, created_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/v1/webhooks — create a webhook
 */
export async function POST(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = WebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('outbound_webhooks')
    .insert({
      organization_id: ctx.organizationId,
      ...parsed.data,
    } as never)
    .select('id, name, url, events, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
