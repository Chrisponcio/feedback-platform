import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/pulse-surveys
 * Evaluates pulse_schedules due for sending and creates web-link distributions.
 * Runs hourly on Vercel Pro plan (0 * * * *).
 *
 * Note: Email delivery to org members requires Resend (deferred to end of project).
 * This cron creates the distribution tokens so they can be shared manually or
 * via email when Resend is configured.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date()

  // Find active schedules due for sending
  const { data: schedules } = await supabase
    .from('pulse_schedules')
    .select('id, organization_id, survey_id, name, cron_expression, anonymity_mode')
    .eq('is_active' as never, true)
    .or(`next_send_at.is.null,next_send_at.lte.${now.toISOString()}` as never)

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  type Schedule = {
    id: string
    organization_id: string
    survey_id: string
    name: string
    cron_expression: string | null
    anonymity_mode: boolean
  }

  let processed = 0

  for (const schedule of schedules as unknown as Schedule[]) {
    // Create a new web_link distribution for this pulse run
    const token = generateToken()
    const { error } = await supabase
      .from('survey_distributions')
      .insert({
        organization_id: schedule.organization_id,
        survey_id:       schedule.survey_id,
        channel:         'web_link',
        token,
        is_active:       true,
        metadata: {
          pulse_schedule_id: schedule.id,
          pulse_name:        schedule.name,
          sent_at:           now.toISOString(),
        },
      } as never)

    if (error) {
      console.error(`Pulse schedule ${schedule.id} distribution error:`, error.message)
      continue
    }

    // Update last_sent_at and compute next_send_at
    const next = computeNextSend(schedule.cron_expression, now)
    await supabase
      .from('pulse_schedules')
      .update({
        last_sent_at: now.toISOString(),
        next_send_at: next?.toISOString() ?? null,
      } as never)
      .eq('id', schedule.id)

    processed++
  }

  return NextResponse.json({ processed })
}

function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Very simple cron expression parser — supports common patterns.
 * Returns next Date >= from, or null if unparseable.
 */
function computeNextSend(cron: string | null, from: Date): Date | null {
  if (!cron) return null

  // Supported presets
  const PRESETS: Record<string, (d: Date) => Date> = {
    '0 9 * * 1': (d) => {
      // Next Monday 09:00 UTC
      const next = new Date(d)
      next.setUTCHours(9, 0, 0, 0)
      const daysUntilMonday = (1 - next.getUTCDay() + 7) % 7 || 7
      next.setUTCDate(next.getUTCDate() + daysUntilMonday)
      return next
    },
    '0 9 1,15 * *': (d) => {
      // Next 1st or 15th of month at 09:00 UTC
      const next = new Date(d)
      next.setUTCHours(9, 0, 0, 0)
      const day = next.getUTCDate()
      if (day < 15) { next.setUTCDate(15) }
      else { next.setUTCMonth(next.getUTCMonth() + 1, 1) }
      return next
    },
    '0 9 1 * *': (d) => {
      // First of next month at 09:00 UTC
      const next = new Date(d)
      next.setUTCMonth(next.getUTCMonth() + 1, 1)
      next.setUTCHours(9, 0, 0, 0)
      return next
    },
    '0 9 * * *': (d) => {
      // Next day at 09:00 UTC
      const next = new Date(d)
      next.setUTCDate(next.getUTCDate() + 1)
      next.setUTCHours(9, 0, 0, 0)
      return next
    },
  }

  const fn = PRESETS[cron.trim()]
  return fn ? fn(from) : null
}
