'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Workflow {
  id: string
  name: string
  description: string | null
  survey_id: string | null
  trigger_type: string
  condition: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  is_active: boolean
  trigger_count: number
  last_triggered_at: string | null
  created_at: string
}

interface WorkflowLog {
  id: string
  trigger_id: string
  status: string
  result: Record<string, unknown> | null
  created_at: string
}

interface Survey {
  id: string
  title: string
}

interface Props {
  initialWorkflows: Workflow[]
  surveys: Survey[]
  recentLogs: WorkflowLog[]
  canManage: boolean
}

const TRIGGER_LABELS: Record<string, string> = {
  nps_detractor: 'NPS Detractor (0–6)',
  nps_passive: 'NPS Passive (7–8)',
  nps_promoter: 'NPS Promoter (9–10)',
  csat_low: 'CSAT Low (1–2)',
  csat_high: 'CSAT High (4–5)',
  keyword_match: 'Keyword Match',
  sentiment_negative: 'Negative Sentiment',
  response_created: 'Any Response',
}

const ACTION_LABELS: Record<string, string> = {
  zendesk_ticket: 'Create Zendesk Ticket',
  slack_message: 'Send Slack Message',
  email_notification: 'Send Email',
  webhook: 'Fire Webhook',
  tag_response: 'Tag Response',
}

export function WorkflowsPanel({ initialWorkflows, surveys, recentLogs, canManage }: Props) {
  const router = useRouter()
  const [workflows, setWorkflows] = useState(initialWorkflows)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [surveyId, setSurveyId] = useState<string>('')
  const [triggerType, setTriggerType] = useState('nps_detractor')
  const [actionType, setActionType] = useState('zendesk_ticket')
  const [keywords, setKeywords] = useState('')

  // Action config fields
  const [zendeskSubdomain, setZendeskSubdomain] = useState('')
  const [zendeskEmail, setZendeskEmail] = useState('')
  const [zendeskToken, setZendeskToken] = useState('')
  const [slackWebhook, setSlackWebhook] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')

  async function handleCreate() {
    setError(null)

    const condition: Record<string, unknown> = {}
    if (triggerType === 'keyword_match') {
      condition.keywords = keywords.split(',').map((k) => k.trim()).filter(Boolean)
    }

    const actionConfig: Record<string, unknown> = {}
    if (actionType === 'zendesk_ticket') {
      actionConfig.subdomain = zendeskSubdomain
      actionConfig.email = zendeskEmail
      actionConfig.api_token = zendeskToken
    } else if (actionType === 'slack_message') {
      actionConfig.webhook_url = slackWebhook
    } else if (actionType === 'webhook') {
      actionConfig.url = webhookUrl
    }

    const res = await fetch('/api/v1/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || undefined,
        survey_id: surveyId || null,
        trigger_type: triggerType,
        condition,
        action_type: actionType,
        action_config: actionConfig,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(body.error ?? `Error ${res.status}`)
      return
    }

    const created = await res.json() as Workflow
    setWorkflows((prev) => [created, ...prev])
    setShowForm(false)
    resetForm()
    router.refresh()
  }

  function resetForm() {
    setName('')
    setDescription('')
    setSurveyId('')
    setTriggerType('nps_detractor')
    setActionType('zendesk_ticket')
    setKeywords('')
    setZendeskSubdomain('')
    setZendeskEmail('')
    setZendeskToken('')
    setSlackWebhook('')
    setWebhookUrl('')
  }

  async function toggleActive(wf: Workflow) {
    await fetch(`/api/v1/workflows/${wf.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !wf.is_active }),
    })
    setWorkflows((prev) =>
      prev.map((w) => (w.id === wf.id ? { ...w, is_active: !w.is_active } : w))
    )
  }

  async function handleDelete(id: string) {
    await fetch(`/api/v1/workflows/${id}`, { method: 'DELETE' })
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Workflow list */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-semibold">Active Workflows</h3>
          {canManage && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {showForm ? 'Cancel' : '+ New Workflow'}
            </button>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <div className="border-b px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NPS detractor → Zendesk"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Survey (optional)</label>
                <select
                  value={surveyId}
                  onChange={(e) => setSurveyId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">All surveys</option>
                  {surveys.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this workflow do?"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Trigger (When)</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Action (Then)</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Keyword input for keyword_match trigger */}
            {triggerType === 'keyword_match' && (
              <div>
                <label className="mb-1 block text-xs font-medium">Keywords (comma-separated)</label>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="bug, broken, terrible"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* Zendesk config */}
            {actionType === 'zendesk_ticket' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium">Zendesk Subdomain</label>
                  <input
                    value={zendeskSubdomain}
                    onChange={(e) => setZendeskSubdomain(e.target.value)}
                    placeholder="yourcompany"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Agent Email</label>
                  <input
                    value={zendeskEmail}
                    onChange={(e) => setZendeskEmail(e.target.value)}
                    placeholder="agent@company.com"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">API Token</label>
                  <input
                    type="password"
                    value={zendeskToken}
                    onChange={(e) => setZendeskToken(e.target.value)}
                    placeholder="zen_..."
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Slack config */}
            {actionType === 'slack_message' && (
              <div>
                <label className="mb-1 block text-xs font-medium">Slack Webhook URL</label>
                <input
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* Webhook config */}
            {actionType === 'webhook' && (
              <div>
                <label className="mb-1 block text-xs font-medium">Webhook URL</label>
                <input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.example.com/webhook"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={!name}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create Workflow
            </button>
          </div>
        )}

        {/* Existing workflows */}
        {workflows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No workflows yet. Create one to automate follow-up actions.
          </div>
        ) : (
          <ul className="divide-y">
            {workflows.map((wf) => (
              <li key={wf.id} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-2 w-2 rounded-full ${wf.is_active ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    <p className="truncate text-sm font-medium">{wf.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">{TRIGGER_LABELS[wf.trigger_type] ?? wf.trigger_type}</span>
                    {' → '}
                    <span className="font-medium">{ACTION_LABELS[wf.action_type] ?? wf.action_type}</span>
                    {wf.trigger_count > 0 && (
                      <span className="ml-2">· {wf.trigger_count} times triggered</span>
                    )}
                  </p>
                </div>
                {canManage && (
                  <div className="ml-4 flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(wf)}
                      className="rounded px-2 py-1 text-xs hover:bg-accent"
                    >
                      {wf.is_active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent execution logs */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3">
          <h3 className="text-sm font-semibold">Recent Executions</h3>
        </div>
        {recentLogs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No workflow executions yet.
          </div>
        ) : (
          <ul className="divide-y">
            {recentLogs.slice(0, 20).map((log) => {
              const wf = workflows.find((w) => w.id === log.trigger_id)
              return (
                <li key={log.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{wf?.name ?? log.trigger_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
                    log.status === 'success'
                      ? 'bg-emerald-100 text-emerald-700'
                      : log.status === 'failure'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {log.status}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
