import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/org/memberships
 * Returns all organizations the current user belongs to.
 * Used by the org-switcher component in the header.
 */
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('organization_members')
    .select('role, organization_id, organizations!inner(id, name, slug)')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    role: string
    organization_id: string
    organizations: { id: string; name: string; slug: string }
  }

  const orgs = (data as unknown as Row[]).map((row) => ({
    id: row.organizations.id,
    name: row.organizations.name,
    slug: row.organizations.slug,
    role: row.role,
  }))

  return NextResponse.json({ data: orgs })
}
