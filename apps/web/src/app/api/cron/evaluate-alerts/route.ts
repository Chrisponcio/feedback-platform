import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/evaluate-alerts
 * Evaluates all active alert rules for all orgs.
 * Should run every 15–60 minutes (Vercel Pro cron).
 *
 * Each rule computes a metric over `window_hours` and fires
 * if the condition is met and the rule hasn't triggered in the same window.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: rules } = await supabase
    .from('alert_rules')
    .select('id, organization_id, survey_id, name, metric, condition, threshold, window_hours, channels, last_triggered_at')
    .eq('is_active', true)

  if (!rules || rules.length === 0) {
    return NextResponse.json({ evaluated: 0 })
  }

  type Rule = {
    id: string
    organization_id: string
    survey_id: string | null
    name: string
    metric: 'nps' | 'csat' | 'response_count' | 'completion_rate'
    condition: 'lt' | 'lte' | 'gt' | 'gte' | 'eq'
    threshold: number
    window_hours: number
    channels: { email?: boolean; slack?: string }
    last_triggered_at: string | null
  }

  let triggered = 0

  for (const rule of rules as unknown as Rule[]) {
    const since = new Date(Date.now() - rule.window_hours * 3600_000).toISOString()

    // Skip if already triggered within this window
    if (rule.last_triggered_at && new Date(rule.last_triggered_at) > new Date(since)) continue

    const value = await computeMetric(supabase, rule, since)
    if (value === null) continue

    if (!evaluate(value, rule.condition, rule.threshold)) continue

    // Fire notifications
    await sendAlertNotifications(rule, value)

    // Update last_triggered_at + last_value
    await supabase
      .from('alert_rules')
      .update({ last_triggered_at: new Date().toISOString(), last_value: value } as never)
      .eq('id', rule.id)

    triggered++
  }

  return NextResponse.json({ evaluated: rules.length, triggered })
}

// ── Metric computation ────────────────────────────────────────────────────────

async function computeMetric(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rule: { organization_id: string; survey_id: string | null; metric: string; window_hours: number },
  since: string
): Promise<number | null> {
  let baseQuery = supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', rule.organization_id)
    .gte('created_at', since)

  if (rule.survey_id) baseQuery = baseQuery.eq('survey_id', rule.survey_id)

  if (rule.metric === 'response_count') {
    const { count } = await baseQuery.eq('is_complete', true)
    return count ?? null
  }

  if (rule.metric === 'completion_rate') {
    const [{ count: total }, { count: complete }] = await Promise.all([
      baseQuery,
      baseQuery.eq('is_complete', true),
    ])
    if (!total || total === 0) return null
    return ((complete ?? 0) / total) * 100
  }

  if (rule.metric === 'nps') {
    let q = supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('question_type', 'nps')
      .gte('created_at', since)
      .not('value_numeric', 'is', null)

    if (rule.survey_id) {
      // Join via responses to filter by survey
      q = supabase
        .from('response_answers')
        .select('value_numeric, responses!inner(survey_id, organization_id)')
        .eq('question_type', 'nps')
        .eq('responses.organization_id', rule.organization_id)
        .gte('created_at', since)
        .not('value_numeric', 'is', null)
      if (rule.survey_id) q = q.eq('responses.survey_id', rule.survey_id)
    }

    const { data } = await q
    if (!data || data.length === 0) return null

    type Row = { value_numeric: number }
    const values = (data as unknown as Row[]).map((r) => r.value_numeric)
    const promoters  = values.filter((v) => v >= 9).length
    const detractors = values.filter((v) => v <= 6).length
    return Math.round(((promoters - detractors) / values.length) * 100)
  }

  if (rule.metric === 'csat') {
    const { data } = await supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('question_type', 'csat')
      .gte('created_at', since)
      .not('value_numeric', 'is', null)

    if (!data || data.length === 0) return null
    type Row = { value_numeric: number }
    const values = (data as unknown as Row[]).map((r) => r.value_numeric)
    return values.reduce((s, v) => s + v, 0) / values.length
  }

  return null
}

function evaluate(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case 'lt':  return value < threshold
    case 'lte': return value <= threshold
    case 'gt':  return value > threshold
    case 'gte': return value >= threshold
    case 'eq':  return value === threshold
    default:    return false
  }
}

// ── Notification delivery ─────────────────────────────────────────────────────

async function sendAlertNotifications(
  rule: { name: string; metric: string; condition: string; threshold: number; channels: { email?: boolean; slack?: string } },
  value: number
): Promise<void> {
  const message = `Alert: "${rule.name}" — ${rule.metric} is ${value.toFixed(1)} (${rule.condition} ${rule.threshold})`

  if (rule.channels.slack) {
    try {
      await fetch(rule.channels.slack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // Slack delivery failure is non-fatal
    }
  }

  // Email via Resend (deferred — RESEND_API_KEY may not be configured)
  if (rule.channels.email && process.env.RESEND_API_KEY) {
    // Resend integration placeholder — see Phase 3f note in PHASES.md
  }
}
