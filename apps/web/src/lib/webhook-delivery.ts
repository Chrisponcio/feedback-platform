/**
 * Outbound webhook delivery with HMAC-SHA256 signing and exponential backoff retry.
 *
 * Retry schedule: attempt 1 (immediate), attempt 2 (5 s delay), attempt 3 (25 s delay).
 * After 3 consecutive failures the webhook's failure_count is incremented.
 * We do NOT disable webhooks automatically — that's a manual admin action.
 */

import { createServiceRoleClient } from './supabase/server'
import { WEBHOOK_EVENTS, type WebhookEvent } from './webhook-events'
export type { WebhookEvent } from './webhook-events'
export { WEBHOOK_EVENTS }

export interface WebhookPayload {
  event: WebhookEvent
  organization_id: string
  created_at: string       // ISO timestamp
  data: Record<string, unknown>
}

const RETRY_DELAYS_MS = [0, 5_000, 25_000] // 3 attempts

/**
 * Fire all active webhooks subscribed to `event` for the given org.
 * Runs in a try/catch — never throws; failures are logged to DB.
 *
 * Call this fire-and-forget (void, no await) from API routes so the
 * response is not held up by webhook delivery latency.
 */
export async function fireWebhooks(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceRoleClient()

  const { data: hooks } = await supabase
    .from('outbound_webhooks')
    .select('id, url, secret, events')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (!hooks || hooks.length === 0) return

  type HookRow = { id: string; url: string; secret: string | null; events: string[] }
  const matching = (hooks as unknown as HookRow[]).filter((h) => h.events.includes(event))
  if (matching.length === 0) return

  const payload: WebhookPayload = {
    event,
    organization_id: organizationId,
    created_at: new Date().toISOString(),
    data,
  }
  const body = JSON.stringify(payload)

  await Promise.allSettled(matching.map((hook) => deliverWithRetry(hook, body)))
}

async function deliverWithRetry(
  hook: { id: string; url: string; secret: string | null },
  body: string
): Promise<void> {
  const supabase = createServiceRoleClient()
  let lastError: string | null = null

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt]!
    if (delay > 0) await sleep(delay)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Pulse-Event': 'webhook',
        'X-Pulse-Timestamp': Date.now().toString(),
      }

      if (hook.secret) {
        headers['X-Pulse-Signature'] = await sign(body, hook.secret)
      }

      const res = await fetch(hook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) })

      if (res.ok) {
        // Success — update last_triggered_at and clear error
        void supabase
          .from('outbound_webhooks')
          .update({ last_triggered_at: new Date().toISOString(), last_error: null, failure_count: 0 } as never)
          .eq('id', hook.id)
        return
      }

      lastError = `HTTP ${res.status} ${res.statusText}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  // All attempts failed — read current failure_count then increment
  const { data: current } = await supabase
    .from('outbound_webhooks')
    .select('failure_count')
    .eq('id', hook.id)
    .single()

  const newCount = ((current as unknown as { failure_count: number } | null)?.failure_count ?? 0) + 1

  void supabase
    .from('outbound_webhooks')
    .update({
      failure_count: newCount,
      last_error: lastError,
      last_triggered_at: new Date().toISOString(),
    } as never)
    .eq('id', hook.id)
}

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return 'sha256=' + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
