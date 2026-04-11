import type { Metadata } from 'next'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ApiKeysPanel } from '@/components/settings/api-keys-panel'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = (user?.app_metadata?.organization_id as string | undefined) ?? ''
  const role  = (user?.app_metadata?.role as string | undefined) ?? 'viewer'

  const serviceClient = createServiceRoleClient()
  const { data: apiKeys } = await serviceClient
    .from('api_keys')
    .select('id, name, key_prefix, type, scopes, last_used_at, expires_at, created_at')
    .eq('organization_id', orgId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage API keys and organization settings</p>
      </div>

      <ApiKeysPanel
        initialKeys={apiKeys ?? []}
        canManage={role === 'owner' || role === 'admin'}
      />
    </div>
  )
}
