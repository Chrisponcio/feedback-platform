import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { WEBHOOK_EVENTS } from '@/lib/webhook-events'

/**
 * Zapier REST Hooks — Subscribe
 * POST /api/v1/zapier/subscribe
 *
 * Zapier sends this when a user enables a trigger zap.
 * Body: { hookUrl, event }
 *
 * Returns the created webhook ID so Zapier can unsubscribe later.
 */

const SubscribeSchema = z.object({
  hookUrl: z.string().url(),
  event:   z.enum(WEBHOOK_EVENTS).default('response.created'),
  data:    z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { hookUrl, event } = parsed.data
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('outbound_webhooks')
    .insert({
      organization_id: ctx.organizationId,
      name: `Zapier — ${event}`,
      url: hookUrl,
      events: [event],
    } as never)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: (data as unknown as { id: string }).id }, { status: 201 })
}
