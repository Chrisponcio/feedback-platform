import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/org/switch
 * Switches the current user's active organization by updating app_metadata.
 * The custom access token hook reads organization_id from app_metadata,
 * so the next token refresh will embed the new org's claims.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetOrgId = (body as { organization_id?: unknown }).organization_id
  if (typeof targetOrgId !== 'string' || !targetOrgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 })
  }

  const serviceClient = createServiceRoleClient()

  // Verify the user is actually a member of the target org
  const { data: membership, error: memberError } = await serviceClient
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', targetOrgId)
    .is('deleted_at', null)
    .single()

  if (memberError || !membership) {
    return NextResponse.json({ error: 'Not a member of that organization' }, { status: 403 })
  }

  // Update app_metadata to switch active org + role
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      organization_id: targetOrgId,
      role: (membership as unknown as { role: string }).role,
    },
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, organization_id: targetOrgId })
}
