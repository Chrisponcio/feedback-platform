'use client'

import { useState, useTransition } from 'react'

type Metric = 'nps' | 'csat' | 'response_count' | 'completion_rate'
type Condition = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'

interface AlertRule {
  id: string
  name: string
  metric: Metric
  condition: Condition
  threshold: number
  window_hours: number
  channels: { email?: boolean; slack?: string }
  is_active: boolean
  last_triggered_at: string | null
  last_value: number | null
  survey_id: string | null
  created_at: string
}

interface Survey { id: string; title: string }

interface AlertRulesPanelProps {
  initialRules: AlertRule[]
  surveys: Survey[]
  canManage: boolean
}

const METRIC_LABELS: Record<Metric, string> = {
  nps:             'NPS score',
  csat:            'CSAT average',
  response_count:  'Response count',
  completion_rate: 'Completion rate (%)',
}

const CONDITION_LABELS: Record<Condition, string> = {
  lt:  '<  less than',
  lte: '≤  at most',
  gt:  '>  greater than',
  gte: '≥  at least',
  eq:  '=  equals',
}

const BLANK_FORM = {
  name:         '',
  metric:       'response_count' as Metric,
  condition:    'lt' as Condition,
  threshold:    '10',
  window_hours: '24',
  survey_id:    '',
  slack_url:    '',
}

export function AlertRulesPanel({ initialRules, surveys, canManage }: AlertRulesPanelProps) {
  const [rules, setRules]       = useState<AlertRule[]>(initialRules)
  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState(BLANK_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError]       = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const body = {
        name:         form.name,
        metric:       form.metric,
        condition:    form.condition,
        threshold:    parseFloat(form.threshold),
        window_hours: parseInt(form.window_hours, 10),
        channels:     form.slack_url ? { slack: form.slack_url } : {},
        ...(form.survey_id ? { survey_id: form.survey_id } : {}),
      }

      const res = await fetch('/api/v1/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { data?: AlertRule; error?: unknown }
      if (!res.ok || !json.data) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create rule')
        return
      }
      setRules((prev) => [json.data!, ...prev])
      setCreating(false)
      setForm(BLANK_FORM)
    })
  }

  async function handleDelete(id: string) {
    await fetch(`/api/v1/alert-rules/${id}`, { method: 'DELETE' })
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleToggle(rule: AlertRule) {
    const res = await fetch(`/api/v1/alert-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    if (res.ok) {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Alert Rules</h2>
          <p className="text-sm text-muted-foreground">
            Get notified via Slack when a metric crosses a threshold.
          </p>
        </div>
        {canManage && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add rule
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={(e) => void handleCreate(e)} className="rounded-md border bg-background p-4 space-y-3">
          <h3 className="text-sm font-medium">New alert rule</h3>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rule name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Low NPS alert"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Metric</label>
              <select
                value={form.metric}
                onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as Metric }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as Condition }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.entries(CONDITION_LABELS) as [Condition, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Threshold</label>
              <input
                type="number"
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Window (hours)</label>
              <input
                type="number"
                min="1"
                value={form.window_hours}
                onChange={(e) => setForm((f) => ({ ...f, window_hours: e.target.value }))}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {surveys.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Survey (optional)</label>
                <select
                  value={form.survey_id}
                  onChange={(e) => setForm((f) => ({ ...f, survey_id: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All surveys</option>
                  {surveys.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Slack webhook URL <span className="font-normal">(Incoming Webhook from Slack app)</span>
            </label>
            <input
              type="url"
              value={form.slack_url}
              onChange={(e) => setForm((f) => ({ ...f, slack_url: e.target.value }))}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
            >
              {isPending ? 'Creating…' : 'Create rule'}
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

      {rules.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No alert rules configured.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-start justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{rule.name}</p>
                  {!rule.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {METRIC_LABELS[rule.metric]} {rule.condition} {rule.threshold}
                  {' · '}{rule.window_hours}h window
                  {rule.last_value !== null && (
                    <span> · last value: {rule.last_value.toFixed(1)}</span>
                  )}
                </p>
                {rule.last_triggered_at && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Last triggered {new Date(rule.last_triggered_at).toLocaleString()}
                  </p>
                )}
              </div>
              {canManage && (
                <div className="flex gap-2 shrink-0 pt-0.5">
                  <button
                    onClick={() => void handleToggle(rule)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {rule.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => void handleDelete(rule.id)}
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
