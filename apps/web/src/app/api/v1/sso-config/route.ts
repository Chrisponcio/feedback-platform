import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { z } from 'zod'

const OWNER_ROLES = ['owner']

const UpsertSchema = z.object({
  domain:         z.string().min(1).max(253).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  provider_type:  z.enum(['saml', 'oidc']).default('saml'),
  metadata_url:   z.string().url().optional().nullable(),
  metadata_xml:   z.string().optional().nullable(),
  attribute_mapping: z.object({
    email:      z.string().optional(),
    first_name: z.string().optional(),
    last_name:  z.string().optional(),
  }).optional(),
})

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('org_sso_configs' as never)
    .select('id, domain, provider_type, metadata_url, attribute_mapping, is_active, supabase_provider_id, created_at, updated_at')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? null })
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !OWNER_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden — owner only' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const serviceClient = createServiceRoleClient()

  // Upsert SSO config
  const { data, error } = await serviceClient
    .from('org_sso_configs' as never)
    .upsert({
      organization_id: orgId,
      ...parsed.data,
      is_active: false, // stays false until Supabase provider is provisioned
    } as never, { onConflict: 'organization_id' })
    .select('id, domain, provider_type, metadata_url, attribute_mapping, is_active, supabase_provider_id, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !OWNER_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden — owner only' }, { status: 403 })
  }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('org_sso_configs' as never)
    .delete()
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
