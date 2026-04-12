import type { Metadata } from 'next'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { PulseSchedulesPanel } from '@/components/pulse/pulse-schedules-panel'

export const metadata: Metadata = { title: 'Pulse Surveys' }

export default async function PulsePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = (user?.app_metadata?.organization_id as string | undefined) ?? ''
  const role  = (user?.app_metadata?.role as string | undefined) ?? 'viewer'

  const serviceClient = createServiceRoleClient()

  const [{ data: schedules }, { data: surveys }] = await Promise.all([
    serviceClient
      .from('pulse_schedules')
      .select('id, name, cron_expression, is_active, anonymity_mode, last_sent_at, next_send_at, created_at, surveys(title)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),

    serviceClient
      .from('surveys')
      .select('id, title')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['active', 'draft'])
      .order('title'),
  ])

  type ScheduleRow = {
    id: string; name: string; cron_expression: string | null
    is_active: boolean; anonymity_mode: boolean
    last_sent_at: string | null; next_send_at: string | null; created_at: string
    surveys: { title: string } | null
  }
  type SurveyRow = { id: string; title: string }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pulse Surveys</h1>
        <p className="text-muted-foreground">
          Automatically send recurring feedback surveys to your team on a schedule.
        </p>
      </div>

      <PulseSchedulesPanel
        initialSchedules={(schedules as unknown as ScheduleRow[] | null) ?? []}
        surveys={(surveys as unknown as SurveyRow[] | null) ?? []}
        canManage={['owner', 'admin'].includes(role)}
      />
    </div>
  )
}
