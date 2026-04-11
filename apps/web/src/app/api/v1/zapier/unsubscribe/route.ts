import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Zapier REST Hooks — Unsubscribe
 * DELETE /api/v1/zapier/unsubscribe
 *
 * Zapier sends this when a user turns off a trigger zap.
 * Body: { id }  — the webhook ID returned at subscribe time.
 */

const UnsubscribeSchema = z.object({
  id: z.string().uuid(),
})

export async function DELETE(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UnsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('outbound_webhooks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('organization_id', ctx.organizationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
