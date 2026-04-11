import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/api-auth'
import { z } from 'zod'

const WRITE_ROLES = ['owner', 'admin']

const CreateKeySchema = z.object({
  name:       z.string().min(1).max(100),
  type:       z.enum(['live', 'test']).default('live'),
  scopes:     z.array(z.string()).default(['read']),
  expires_at: z.string().datetime().optional(),
})

/**
 * GET /api/v1/keys  (dashboard — requires session auth, not API key)
 * List API keys for the current org (hashes are never returned).
 */
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('api_keys')
    .select('id, name, key_prefix, type, scopes, last_used_at, expires_at, revoked_at, created_at')
    .eq('organization_id', orgId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/v1/keys  (dashboard — requires session auth, not API key)
 * Create a new API key. Returns rawKey exactly once.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!role || !WRITE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden — owner or admin required' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, type, scopes, expires_at } = parsed.data
  const { rawKey, prefix, hash } = await generateApiKey(type)

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('api_keys')
    .insert({
      organization_id: orgId,
      name,
      type,
      key_hash:   hash,
      key_prefix: prefix,
      scopes,
      ...(expires_at ? { expires_at } : {}),
    } as never)
    .select('id, name, key_prefix, type, scopes, expires_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { ...(data as object), raw_key: rawKey } }, { status: 201 })
}

/**
 * DELETE /api/v1/keys?id=<keyId>  (dashboard — revoke a key)
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!role || !WRITE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden — owner or admin required' }, { status: 403 })
  }

  const keyId = request.nextUrl.searchParams.get('id')
  if (!keyId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq('id', keyId)
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
