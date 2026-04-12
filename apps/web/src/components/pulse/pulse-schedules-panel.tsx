'use client'

import { useState, useTransition } from 'react'

interface Schedule {
  id: string
  name: string
  cron_expression: string | null
  is_active: boolean
  anonymity_mode: boolean
  last_sent_at: string | null
  next_send_at: string | null
  created_at: string
  surveys: { title: string } | null
}

interface Survey { id: string; title: string }

interface PulseSchedulesPanelProps {
  initialSchedules: Schedule[]
  surveys: Survey[]
  canManage: boolean
}

const PRESET_CRONS = [
  { label: 'Every Monday at 9 AM',  value: '0 9 * * 1' },
  { label: 'Every 2 weeks (Monday)', value: '0 9 1,15 * *' },
  { label: 'Monthly (1st)',          value: '0 9 1 * *' },
  { label: 'Daily at 9 AM',         value: '0 9 * * *' },
]

const BLANK_FORM = {
  name:            '',
  survey_id:       '',
  cron_expression: '0 9 * * 1',
  anonymity_mode:  true,
}

export function PulseSchedulesPanel({ initialSchedules, surveys, canManage }: PulseSchedulesPanelProps) {
  const [schedules, setSchedules]   = useState<Schedule[]>(initialSchedules)
  const [creating, setCreating]     = useState(false)
  const [form, setForm]             = useState(BLANK_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/v1/pulse-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json() as { data?: Schedule; error?: unknown }
      if (!res.ok || !json.data) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create schedule')
        return
      }
      setSchedules((prev) => [json.data!, ...prev])
      setCreating(false)
      setForm(BLANK_FORM)
    })
  }

  async function handleToggle(schedule: Schedule) {
    const res = await fetch(`/api/v1/pulse-schedules/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !schedule.is_active }),
    })
    if (res.ok) {
      setSchedules((prev) => prev.map((s) => s.id === schedule.id ? { ...s, is_active: !s.is_active } : s))
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/v1/pulse-schedules/${id}`, { method: 'DELETE' })
    setSchedules((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Schedules automatically create web-link distributions and send email invitations
          to all org members at the configured interval.
        </p>
        {canManage && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New schedule
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={(e) => void handleCreate(e)} className="rounded-md border bg-background p-4 space-y-3">
          <h3 className="text-sm font-medium">New pulse schedule</h3>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Weekly Team Pulse"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Survey</label>
              <select
                value={form.survey_id}
                onChange={(e) => setForm((f) => ({ ...f, survey_id: e.target.value }))}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select survey…</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Schedule</label>
            <select
              value={form.cron_expression}
              onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PRESET_CRONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.anonymity_mode}
              onChange={(e) => setForm((f) => ({ ...f, anonymity_mode: e.target.checked }))}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="text-sm">Anonymous responses (recommended)</span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
            >
              {isPending ? 'Creating…' : 'Create schedule'}
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

      {schedules.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No pulse schedules configured.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-start justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{s.name}</p>
                  {!s.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Paused</span>
                  )}
                  {s.anonymity_mode && (
                    <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs">Anonymous</span>
                  )}
                </div>
                {s.surveys && (
                  <p className="text-xs text-muted-foreground mt-0.5">{s.surveys.title}</p>
                )}
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {s.cron_expression ?? '—'}
                  {s.next_send_at && (
                    <> · next {new Date(s.next_send_at).toLocaleDateString()}</>
                  )}
                  {s.last_sent_at && (
                    <> · last sent {new Date(s.last_sent_at).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2 shrink-0 pt-0.5">
                  <button
                    onClick={() => void handleToggle(s)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {s.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => void handleDelete(s.id)}
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
    </div>
  )
}
