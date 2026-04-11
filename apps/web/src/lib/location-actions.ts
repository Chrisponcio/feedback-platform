'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from './supabase/server'

const locationSchema = z.object({
  name:     z.string().min(1, 'Name is required').max(100),
  address:  z.string().max(255).optional(),
  city:     z.string().max(100).optional(),
  state:    z.string().max(100).optional(),
  country:  z.string().length(2).default('US'),
  timezone: z.string().min(1).default('UTC'),
})

async function getCallerOrg() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, orgId: null, role: null }
  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId) return { error: 'No organization' as const, orgId: null, role: null }
  return { error: null, orgId, role: role ?? 'viewer' }
}

// ── Create location ──────────────────────────────────────────────────────────

export async function createLocation(formData: FormData) {
  const { error: authError, orgId, role } = await getCallerOrg()
  if (authError) return { error: authError }
  if (!['owner', 'admin', 'manager'].includes(role!)) return { error: 'Forbidden' }

  const parsed = locationSchema.safeParse({
    name:     formData.get('name'),
    address:  formData.get('address') || undefined,
    city:     formData.get('city')    || undefined,
    state:    formData.get('state')   || undefined,
    country:  formData.get('country') || 'US',
    timezone: formData.get('timezone') || 'UTC',
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('locations')
    .insert({ ...parsed.data, organization_id: orgId! } as never)
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create location' }

  revalidatePath('/locations')
  return { locationId: (data as unknown as { id: string }).id }
}

// ── Update location ──────────────────────────────────────────────────────────

export async function updateLocation(locationId: string, formData: FormData) {
  const { error: authError, orgId, role } = await getCallerOrg()
  if (authError) return { error: authError }
  if (!['owner', 'admin', 'manager'].includes(role!)) return { error: 'Forbidden' }

  const parsed = locationSchema.safeParse({
    name:     formData.get('name'),
    address:  formData.get('address') || undefined,
    city:     formData.get('city')    || undefined,
    state:    formData.get('state')   || undefined,
    country:  formData.get('country') || 'US',
    timezone: formData.get('timezone') || 'UTC',
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('locations')
    .update(parsed.data as never)
    .eq('id', locationId)
    .eq('organization_id', orgId!)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/locations')
  return { ok: true }
}

// ── Delete (soft) location ───────────────────────────────────────────────────

export async function deleteLocation(locationId: string) {
  const { error: authError, orgId, role } = await getCallerOrg()
  if (authError) return { error: authError }
  if (!['owner', 'admin'].includes(role!)) return { error: 'Forbidden' }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('locations')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', locationId)
    .eq('organization_id', orgId!)

  if (error) return { error: error.message }

  revalidatePath('/locations')
  return { ok: true }
}

// ── Create kiosk distribution for a location ────────────────────────────────

export async function createKioskDistribution(locationId: string, surveyId: string) {
  const { error: authError, orgId, role } = await getCallerOrg()
  if (authError) return { error: authError }
  if (!['owner', 'admin', 'manager'].includes(role!)) return { error: 'Forbidden' }

  const serviceClient = createServiceRoleClient()

  // Check for existing active kiosk distribution at this location
  const { data: existing } = await serviceClient
    .from('survey_distributions')
    .select('id, token')
    .eq('survey_id', surveyId)
    .eq('organization_id', orgId!)
    .eq('channel', 'kiosk')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .single()

  if (existing) {
    const row = existing as unknown as { token: string }
    return { token: row.token }
  }

  const { data, error } = await serviceClient
    .from('survey_distributions')
    .insert({
      survey_id: surveyId,
      organization_id: orgId!,
      location_id: locationId,
      channel: 'kiosk',
      name: 'Kiosk',
      is_active: true,
    } as never)
    .select('token')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create kiosk' }

  // Activate the survey
  await serviceClient
    .from('surveys')
    .update({ status: 'active' } as never)
    .eq('id', surveyId)

  revalidatePath('/locations')
  return { token: (data as unknown as { token: string }).token }
}
