import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { SsoConfigPanel } from '@/components/settings/sso-config-panel'

export const metadata: Metadata = { title: 'SSO Configuration' }

export default async function SsoPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = (user.app_metadata?.organization_id as string | undefined) ?? ''
  const role  = (user.app_metadata?.role as string | undefined) ?? 'viewer'

  if (role !== 'owner') {
    redirect('/settings')
  }

  const serviceClient = createServiceRoleClient()
  const { data: ssoConfig } = await serviceClient
    .from('org_sso_configs' as never)
    .select('id, domain, provider_type, metadata_url, attribute_mapping, is_active, supabase_provider_id, updated_at')
    .eq('organization_id', orgId)
    .maybeSingle()

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Single Sign-On</h1>
        <p className="text-muted-foreground">
          Configure SAML 2.0 SSO to let your team sign in with your identity provider.
        </p>
      </div>

      <SsoConfigPanel
        initialConfig={ssoConfig as SsoConfig | null}
      />
    </div>
  )
}

export type SsoConfig = {
  id: string
  domain: string
  provider_type: string
  metadata_url: string | null
  attribute_mapping: Record<string, string>
  is_active: boolean
  supabase_provider_id: string | null
  updated_at: string
}
