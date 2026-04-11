import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ReportBuilder } from '@/components/reports/report-builder'
import { fetchDailyTrend, fetchNpsTrend } from '@/lib/analytics-queries'

export const metadata: Metadata = { title: 'Report Builder' }

interface PageProps {
  params: Promise<{ reportId: string }>
}

export default async function ReportPage({ params }: PageProps) {
  const { reportId } = await params

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = (user?.app_metadata?.organization_id as string | undefined) ?? ''
  const role  = (user?.app_metadata?.role as string | undefined) ?? 'viewer'

  const serviceClient = createServiceRoleClient()

  const [{ data: report }, { data: sections }, { data: surveys }] = await Promise.all([
    serviceClient
      .from('reports')
      .select('id, title, description, survey_id, created_at')
      .eq('id', reportId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single(),

    serviceClient
      .from('report_sections')
      .select('id, type, position, config')
      .eq('report_id', reportId)
      .order('position'),

    serviceClient
      .from('surveys')
      .select('id, title')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('title'),
  ])

  if (!report) notFound()

  // Pre-fetch trend data for chart sections
  const [responseTrend, npsTrend] = await Promise.all([
    fetchDailyTrend(supabase as Parameters<typeof fetchDailyTrend>[0], 30),
    fetchNpsTrend(supabase as Parameters<typeof fetchNpsTrend>[0], 30),
  ])

  type ReportRow = { id: string; title: string; description: string | null; survey_id: string | null; created_at: string }
  type SectionRow = { id: string; type: import('@/components/reports/report-builder').SectionType; position: number; config: Record<string, unknown> }
  type SurveyRow = { id: string; title: string }

  return (
    <ReportBuilder
      report={report as unknown as ReportRow}
      initialSections={(sections as unknown as SectionRow[] | null) ?? []}
      surveys={(surveys as unknown as SurveyRow[] | null) ?? []}
      canEdit={['owner', 'admin', 'manager'].includes(role)}
      responseTrend={responseTrend}
      npsTrend={npsTrend}
    />
  )
}
