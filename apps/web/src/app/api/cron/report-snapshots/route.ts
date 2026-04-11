import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/report-snapshots
 *
 * Runs daily at 02:00 UTC (configured in vercel.json).
 * Computes daily metrics for every active organization and upserts
 * a row into report_snapshots so the analytics dashboard can query
 * pre-aggregated data instead of scanning raw responses.
 *
 * Authorization: CRON_SECRET environment variable (checked by Vercel automatically
 * for cron invocations; we also check it here for safety).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // Determine yesterday's date range
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setUTCHours(0, 0, 0, 0)
  const periodStart = new Date(periodEnd)
  periodStart.setUTCDate(periodStart.getUTCDate() - 1)

  const periodStartStr = periodStart.toISOString().slice(0, 10)
  const periodEndStr   = periodEnd.toISOString().slice(0, 10)

  // Fetch all active orgs
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let processed = 0

  for (const org of orgs as unknown as { id: string }[]) {
    const orgId = org.id

    // Response count for the day
    const { count: responseCount } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_complete', true)
      .gte('created_at', periodStart.toISOString())
      .lt('completed_at', periodEnd.toISOString())

    // NPS average for the day
    const { data: npsData } = await supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('organization_id', orgId)
      .eq('question_type', 'nps')
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString())
      .not('value_numeric', 'is', null)

    type NumRow = { value_numeric: number }
    const npsValues = ((npsData ?? []) as unknown as NumRow[]).map((r) => r.value_numeric)
    const promoters  = npsValues.filter((v) => v >= 9).length
    const detractors = npsValues.filter((v) => v <= 6).length
    const npsScore   = npsValues.length > 0
      ? Math.round(((promoters - detractors) / npsValues.length) * 100)
      : null

    // CSAT average for the day
    const { data: csatData } = await supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('organization_id', orgId)
      .eq('question_type', 'csat')
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString())
      .not('value_numeric', 'is', null)

    const csatValues = ((csatData ?? []) as unknown as NumRow[]).map((r) => r.value_numeric)
    const csatAvg = csatValues.length > 0
      ? csatValues.reduce((s, v) => s + v, 0) / csatValues.length
      : null

    const metrics = {
      response_count: responseCount ?? 0,
      nps_score: npsScore,
      nps_responses: npsValues.length,
      promoters,
      detractors,
      passives: npsValues.length - promoters - detractors,
      csat_average: csatAvg !== null ? Math.round(csatAvg * 100) / 100 : null,
      csat_responses: csatValues.length,
    }

    await supabase
      .from('report_snapshots')
      .upsert(
        {
          organization_id: orgId,
          snapshot_type: 'daily',
          period_start: periodStartStr,
          period_end: periodEndStr,
          metrics,
        } as never,
        { onConflict: 'organization_id,snapshot_type,period_start,period_end', ignoreDuplicates: false }
      )

    processed++
  }

  return NextResponse.json({ ok: true, processed, period: `${periodStartStr}/${periodEndStr}` })
}
