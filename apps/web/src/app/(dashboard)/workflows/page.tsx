import type { Metadata } from 'next'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkflowsPanel } from '@/components/workflows/workflows-panel'

export const metadata: Metadata = { title: 'Workflows' }

export default async function WorkflowsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role = user.app_metadata?.role as string | undefined
  if (!orgId) redirect('/login')

  const canManage = role === 'owner' || role === 'admin'

  const service = createServiceRoleClient()

  type QueryResult<T> = Promise<{ data: T | null; error: unknown }>

  const [{ data: workflows }, { data: surveys }, { data: recentLogs }] = await Promise.all([
    service
      .from('workflow_triggers' as never)
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }) as unknown as QueryResult<unknown[]>,
    service
      .from('surveys')
      .select('id, title')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('title'),
    service
      .from('workflow_logs' as never)
      .select('id, trigger_id, status, result, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50) as unknown as QueryResult<unknown[]>,
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
        <p className="text-muted-foreground">
          Automated follow-up actions triggered by survey responses
        </p>
      </div>

      <WorkflowsPanel
        initialWorkflows={(workflows ?? []) as never[]}
        surveys={(surveys ?? []) as { id: string; title: string }[]}
        recentLogs={(recentLogs ?? []) as never[]}
        canManage={canManage}
      />
    </div>
  )
}
