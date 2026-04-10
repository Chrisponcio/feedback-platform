import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) redirect('/login?error=no_org')

  return <DashboardShell orgId={orgId}>{children}</DashboardShell>
}
