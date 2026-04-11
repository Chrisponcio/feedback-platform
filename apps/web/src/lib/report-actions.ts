'use server'

import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from './supabase/server'

const WRITE_ROLES = ['owner', 'admin', 'manager']

export async function createReport() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !WRITE_ROLES.includes(role)) redirect('/reports')

  const serviceClient = createServiceRoleClient()
  const { data } = await serviceClient
    .from('reports')
    .insert({ organization_id: orgId, created_by: user.id, title: 'Untitled Report' } as never)
    .select('id')
    .single()

  if (!data) redirect('/reports')
  redirect(`/reports/${(data as unknown as { id: string }).id}`)
}

export async function updateReport(
  reportId: string,
  fields: { title?: string; description?: string; survey_id?: string | null }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return { error: 'No organization' }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('reports')
    .update(fields as never)
    .eq('id', reportId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteReport(reportId: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const orgId = user.app_metadata?.organization_id as string | undefined
  const role  = user.app_metadata?.role as string | undefined
  if (!orgId || !role || !WRITE_ROLES.includes(role)) return { error: 'Forbidden' }

  const serviceClient = createServiceRoleClient()
  await serviceClient
    .from('reports')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', reportId)
    .eq('organization_id', orgId)

  redirect('/reports')
}

export async function upsertSection(
  reportId: string,
  section: { id?: string; type: string; position: number; config: Record<string, unknown> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return { error: 'No organization' }

  const serviceClient = createServiceRoleClient()

  if (section.id) {
    const { error } = await serviceClient
      .from('report_sections')
      .update({ position: section.position, config: section.config } as never)
      .eq('id', section.id)
      .eq('report_id', reportId)
    if (error) return { error: error.message }
    return { success: true }
  }

  const { data, error } = await serviceClient
    .from('report_sections')
    .insert({ report_id: reportId, type: section.type, position: section.position, config: section.config } as never)
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { success: true, id: (data as unknown as { id: string }).id }
}

export async function deleteSection(reportId: string, sectionId: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('report_sections')
    .delete()
    .eq('id', sectionId)
    .eq('report_id', reportId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function reorderSections(
  reportId: string,
  sections: { id: string; position: number }[]
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const serviceClient = createServiceRoleClient()
  await Promise.all(
    sections.map(({ id, position }) =>
      serviceClient
        .from('report_sections')
        .update({ position } as never)
        .eq('id', id)
        .eq('report_id', reportId)
    )
  )
  return { success: true }
}
