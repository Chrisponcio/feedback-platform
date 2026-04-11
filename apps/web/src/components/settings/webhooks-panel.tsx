'use client'

import { useState, useTransition } from 'react'
import { WEBHOOK_EVENTS, type WebhookEvent } from '@/lib/webhook-events'

interface Webhook {
  id: string
  name: string
  url: string
  events: WebhookEvent[]
  is_active: boolean
  failure_count: number
  last_triggered_at: string | null
  created_at: string
}

interface WebhooksPanelProps {
  initialWebhooks: Webhook[]
  canManage: boolean
}

const EVENT_LABELS: Record<WebhookEvent, string> = {
  'response.created':      'Response created',
  'response.updated':      'Response updated',
  'survey.created':        'Survey created',
  'survey.status_changed': 'Survey status changed',
}

export function WebhooksPanel({ initialWebhooks, canManage }: WebhooksPanelProps) {
  const [hooks, setHooks]       = useState<Webhook[]>(initialWebhooks)
  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState({ name: '', url: '', secret: '', events: ['response.created'] as WebhookEvent[] })
  const [isPending, startTransition] = useTransition()
  const [error, setError]       = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          url: form.url,
          ...(form.secret ? { secret: form.secret } : {}),
          events: form.events,
        }),
      })
      const json = await res.json() as { data?: Webhook; error?: unknown }
      if (!res.ok || !json.data) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create webhook')
        return
      }
      setHooks((prev) => [json.data!, ...prev])
      setCreating(false)
      setForm({ name: '', url: '', secret: '', events: ['response.created'] })
    })
  }

  async function handleDelete(id: string) {
    await fetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' })
    setHooks((prev) => prev.filter((h) => h.id !== id))
  }

  async function handleToggle(hook: Webhook) {
    const res = await fetch(`/api/v1/webhooks/${hook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !hook.is_active }),
    })
    if (res.ok) {
      setHooks((prev) => prev.map((h) => h.id === hook.id ? { ...h, is_active: !h.is_active } : h))
    }
  }

  function toggleEvent(ev: WebhookEvent) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev)
        ? f.events.filter((e) => e !== ev)
        : [...f.events, ev],
    }))
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Receive real-time POST requests when events happen in Pulse.
          </p>
        </div>
        {canManage && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add webhook
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={(e) => void handleCreate(e)} className="rounded-md border bg-background p-4 space-y-3">
          <h3 className="text-sm font-medium">New webhook</h3>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Slack alerts"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com/hook"
                type="url"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Signing secret <span className="font-normal">(optional — used for HMAC-SHA256 X-Pulse-Signature header)</span>
            </label>
            <input
              value={form.secret}
              onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
              placeholder="at least 8 characters"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Events</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  <span className="text-sm">{EVENT_LABELS[ev]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending || form.events.length === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
            >
              {isPending ? 'Creating…' : 'Create webhook'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(null) }}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {hooks.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No webhooks configured.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {hooks.map((hook) => (
            <div key={hook.id} className="flex items-start justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{hook.name}</p>
                  {hook.failure_count > 0 && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      {hook.failure_count} failures
                    </span>
                  )}
                  {!hook.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{hook.url}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hook.events.map((e) => EVENT_LABELS[e] ?? e).join(', ')}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2 shrink-0 pt-0.5">
                  <button
                    onClick={() => void handleToggle(hook)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {hook.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => void handleDelete(hook.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
