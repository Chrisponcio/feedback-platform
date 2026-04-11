import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'

/**
 * Zapier REST Hooks — Sample data
 * GET /api/v1/zapier/sample?event=response.created
 *
 * Zapier calls this to show users a sample payload when setting up a trigger.
 */
export async function GET(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = request.nextUrl.searchParams.get('event') ?? 'response.created'

  const samples: Record<string, unknown[]> = {
    'response.created': [
      {
        event: 'response.created',
        organization_id: ctx.organizationId,
        created_at: new Date().toISOString(),
        data: {
          response_id: '00000000-0000-0000-0000-000000000001',
          survey_id:   '00000000-0000-0000-0000-000000000002',
          channel: 'web_link',
          language: 'en',
          started_at: new Date(Date.now() - 120_000).toISOString(),
          completed_at: new Date().toISOString(),
          duration_seconds: 120,
        },
      },
    ],
    'survey.status_changed': [
      {
        event: 'survey.status_changed',
        organization_id: ctx.organizationId,
        created_at: new Date().toISOString(),
        data: {
          survey_id: '00000000-0000-0000-0000-000000000002',
          old_status: 'draft',
          new_status: 'active',
        },
      },
    ],
  }

  return NextResponse.json({ data: samples[event] ?? samples['response.created'] })
}
