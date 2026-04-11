import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { processOpenTextAnswer } from '@/lib/ai-sentiment'

const BATCH_SIZE = 10   // process up to 10 jobs per cron tick
const MAX_ATTEMPTS = 3

/**
 * GET /api/cron/process-ai-jobs
 * Processes pending AI sentiment jobs in batches.
 * Runs every 5 minutes (Vercel Pro cron).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'OPENAI_API_KEY not configured' })
  }

  const supabase = createServiceRoleClient()

  // Fetch pending jobs
  const { data: jobs } = await supabase
    .from('pending_ai_jobs')
    .select('id, response_id, question_id, organization_id, text_value, attempts')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at')
    .limit(BATCH_SIZE)

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  type JobRow = {
    id: string
    response_id: string
    question_id: string
    organization_id: string
    text_value: string
    attempts: number
  }

  let processed = 0
  let failed = 0

  for (const job of jobs as unknown as JobRow[]) {
    // Mark as processing
    await supabase
      .from('pending_ai_jobs')
      .update({ status: 'processing', attempts: job.attempts + 1 } as never)
      .eq('id', job.id)

    const success = await processOpenTextAnswer({
      responseId:     job.response_id,
      questionId:     job.question_id,
      organizationId: job.organization_id,
      text:           job.text_value,
    })

    if (success) {
      await supabase
        .from('pending_ai_jobs')
        .update({ status: 'done', processed_at: new Date().toISOString() } as never)
        .eq('id', job.id)
      processed++
    } else {
      const newAttempts = job.attempts + 1
      await supabase
        .from('pending_ai_jobs')
        .update({
          status: newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          error: 'Classification returned null',
        } as never)
        .eq('id', job.id)
      failed++
    }
  }

  return NextResponse.json({ processed, failed, total: jobs.length })
}
