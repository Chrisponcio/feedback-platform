/**
 * Workflow engine — evaluates triggers against incoming responses
 * and executes configured actions (Zendesk, Slack, email, webhook, tag).
 *
 * Called from /api/submit after response is saved.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

interface WorkflowTrigger {
  id: string
  organization_id: string
  trigger_type: string
  condition: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  survey_id: string | null
  is_active: boolean
}

interface ResponseContext {
  response_id: string
  survey_id: string
  organization_id: string
  answers: {
    question_type: string
    value_numeric: number | null
    value_text: string | null
  }[]
}

export async function evaluateWorkflows(
  supabase: SupabaseClient,
  ctx: ResponseContext
) {
  const { data: triggers } = await supabase
    .from('workflow_triggers')
    .select('*')
    .eq('organization_id', ctx.organization_id)
    .eq('is_active', true)

  if (!triggers || triggers.length === 0) return

  for (const trigger of triggers as unknown as WorkflowTrigger[]) {
    // Skip if trigger is scoped to a different survey
    if (trigger.survey_id && trigger.survey_id !== ctx.survey_id) continue

    const matched = matchesTrigger(trigger, ctx)
    if (!matched) continue

    try {
      await executeAction(trigger, ctx)

      // Log success and update trigger
      await Promise.all([
        supabase.from('workflow_logs').insert({
          organization_id: ctx.organization_id,
          trigger_id: trigger.id,
          response_id: ctx.response_id,
          status: 'success',
          result: { action: trigger.action_type },
        }),
        supabase
          .from('workflow_triggers')
          .update({
            last_triggered_at: new Date().toISOString(),
            trigger_count: (trigger as unknown as { trigger_count: number }).trigger_count + 1,
          })
          .eq('id', trigger.id),
      ])
    } catch (err) {
      await supabase.from('workflow_logs').insert({
        organization_id: ctx.organization_id,
        trigger_id: trigger.id,
        response_id: ctx.response_id,
        status: 'failure',
        result: { error: err instanceof Error ? err.message : 'Unknown error' },
      })
    }
  }
}

function matchesTrigger(trigger: WorkflowTrigger, ctx: ResponseContext): boolean {
  const npsAnswer = ctx.answers.find((a) => a.question_type === 'nps')
  const csatAnswer = ctx.answers.find((a) => a.question_type === 'csat')

  switch (trigger.trigger_type) {
    case 'nps_detractor':
      return npsAnswer?.value_numeric != null && npsAnswer.value_numeric <= 6
    case 'nps_passive':
      return npsAnswer?.value_numeric != null && npsAnswer.value_numeric >= 7 && npsAnswer.value_numeric <= 8
    case 'nps_promoter':
      return npsAnswer?.value_numeric != null && npsAnswer.value_numeric >= 9
    case 'csat_low':
      return csatAnswer?.value_numeric != null && csatAnswer.value_numeric <= 2
    case 'csat_high':
      return csatAnswer?.value_numeric != null && csatAnswer.value_numeric >= 4
    case 'keyword_match': {
      const keywords = (trigger.condition.keywords as string[] | undefined) ?? []
      const texts = ctx.answers
        .filter((a) => a.value_text)
        .map((a) => a.value_text!.toLowerCase())
      return keywords.some((kw) => texts.some((t) => t.includes(kw.toLowerCase())))
    }
    case 'sentiment_negative':
      // This is evaluated async after AI tagging — skip in real-time
      return false
    case 'response_created':
      return true
    default:
      return false
  }
}

async function executeAction(
  trigger: WorkflowTrigger,
  ctx: ResponseContext
) {
  const config = trigger.action_config

  switch (trigger.action_type) {
    case 'zendesk_ticket':
      await createZendeskTicket(config, ctx)
      break
    case 'slack_message':
      await sendSlackMessage(config, ctx)
      break
    case 'email_notification':
      // Deferred — Resend integration
      break
    case 'webhook':
      await fireWebhook(config, ctx)
      break
    case 'tag_response':
      // Handled via response_tags — no-op here
      break
  }
}

// ── Zendesk ticket creation ──────────────────────────────────────────────────

async function createZendeskTicket(
  config: Record<string, unknown>,
  ctx: ResponseContext
) {
  const subdomain = config.subdomain as string | undefined
  const apiToken = config.api_token as string | undefined
  const email = config.email as string | undefined

  if (!subdomain || !apiToken || !email) {
    throw new Error('Zendesk config missing: subdomain, email, or api_token')
  }

  const npsAnswer = ctx.answers.find((a) => a.question_type === 'nps')
  const textAnswers = ctx.answers
    .filter((a) => a.value_text)
    .map((a) => a.value_text)
    .join('\n\n')

  const subject = config.subject as string ??
    `Feedback alert: NPS ${npsAnswer?.value_numeric ?? 'N/A'} — Response ${ctx.response_id.slice(0, 8)}`

  const body = [
    `Response ID: ${ctx.response_id}`,
    `Survey ID: ${ctx.survey_id}`,
    npsAnswer ? `NPS Score: ${npsAnswer.value_numeric}` : null,
    textAnswers ? `\nOpen-text feedback:\n${textAnswers}` : null,
  ].filter(Boolean).join('\n')

  const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${email}/token:${apiToken}`)}`,
    },
    body: JSON.stringify({
      ticket: {
        subject,
        comment: { body },
        priority: npsAnswer && npsAnswer.value_numeric !== null && npsAnswer.value_numeric <= 3
          ? 'high' : 'normal',
        tags: ['pulse-feedback', `nps-${npsAnswer?.value_numeric ?? 'na'}`],
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zendesk API ${res.status}: ${text.slice(0, 200)}`)
  }
}

// ── Slack message ─────────────────────────────────────────────────────────────

async function sendSlackMessage(
  config: Record<string, unknown>,
  ctx: ResponseContext
) {
  const webhookUrl = config.webhook_url as string | undefined
  if (!webhookUrl) throw new Error('Slack webhook URL missing')

  const npsAnswer = ctx.answers.find((a) => a.question_type === 'nps')
  const textAnswers = ctx.answers.filter((a) => a.value_text).map((a) => a.value_text)

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Workflow triggered:* ${config.message ?? 'New feedback received'}`,
      },
    },
    npsAnswer ? {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*NPS Score:* ${npsAnswer.value_numeric}` },
        { type: 'mrkdwn', text: `*Response:* \`${ctx.response_id.slice(0, 8)}\`` },
      ],
    } : null,
    textAnswers.length > 0 ? {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Feedback:*\n> ${textAnswers.join('\n> ')}`,
      },
    } : null,
  ].filter(Boolean)

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })

  if (!res.ok) throw new Error(`Slack webhook ${res.status}`)
}

// ── Generic webhook ──────────────────────────────────────────────────────────

async function fireWebhook(
  config: Record<string, unknown>,
  ctx: ResponseContext
) {
  const url = config.url as string | undefined
  if (!url) throw new Error('Webhook URL missing')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.headers as Record<string, string> | undefined),
    },
    body: JSON.stringify({
      event: 'workflow.triggered',
      response_id: ctx.response_id,
      survey_id: ctx.survey_id,
      organization_id: ctx.organization_id,
      answers: ctx.answers,
      triggered_at: new Date().toISOString(),
    }),
  })

  if (!res.ok) throw new Error(`Webhook ${res.status}`)
}
