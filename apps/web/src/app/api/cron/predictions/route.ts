import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generatePredictions } from '@/lib/prediction-engine'

/**
 * Daily cron job: regenerate predictive analytics for all active orgs.
 * Runs via Vercel Cron or manual invocation.
 *
 * GET /api/cron/predictions
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // Get all active organizations
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .is('deleted_at', null)

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: 'No active orgs', processed: 0 })
  }

  let processed = 0
  let errors = 0

  for (const org of orgs) {
    try {
      const predictions = await generatePredictions(supabase, org.id)

      if (predictions.length > 0) {
        const rows = predictions.map((p) => ({
          organization_id: org.id,
          ...p,
        }))

        const { error } = await (supabase.from('org_predictions' as never).insert(rows as never) as unknown as Promise<{ error: { message: string } | null }>)
        if (error) {
          errors++
          continue
        }
      }

      processed++
    } catch {
      errors++
    }
  }

  return NextResponse.json({
    message: `Predictions generated for ${processed} orgs`,
    processed,
    errors,
  })
}
