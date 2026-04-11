import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { WEBHOOK_EVENTS } from '@/lib/webhook-events'

const UpdateSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  url:       z.string().url().optional(),
  secret:    z.string().min(8).optional(),
  events:    z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  is_active: z.boolean().optional(),
})

/**
 * PATCH /api/v1/webhooks/:id — update a webhook
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('outbound_webhooks')
    .update(parsed.data as never)
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .select('id, name, url, events, is_active, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

/**
 * DELETE /api/v1/webhooks/:id — delete a webhook
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('outbound_webhooks')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
