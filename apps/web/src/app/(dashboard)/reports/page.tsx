import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { createReport } from '@/lib/report-actions'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = (user?.app_metadata?.organization_id as string | undefined) ?? ''
  const role  = (user?.app_metadata?.role as string | undefined) ?? 'viewer'
  const canCreate = ['owner', 'admin', 'manager'].includes(role)

  const serviceClient = createServiceRoleClient()
  const { data: reports } = await serviceClient
    .from('reports')
    .select('id, title, description, survey_id, last_exported_at, created_at, surveys(title)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  type ReportRow = {
    id: string
    title: string
    description: string | null
    survey_id: string | null
    last_exported_at: string | null
    created_at: string
    surveys: { title: string } | null
  }

  const rows = (reports as unknown as ReportRow[] | null) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Build and export custom analytics reports</p>
        </div>
        {canCreate && (
          <form action={createReport}>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New report
            </button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">No reports yet.</p>
          {canCreate && (
            <form action={createReport}>
              <button type="submit" className="text-sm text-primary hover:underline">
                Create your first report
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((report) => (
            <Link
              key={report.id}
              href={`/reports/${report.id}`}
              className="rounded-lg border bg-background p-4 hover:border-primary/50 transition-colors"
            >
              <h3 className="font-medium truncate">{report.title}</h3>
              {report.surveys && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {report.surveys.title}
                </p>
              )}
              {report.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {report.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Created {new Date(report.created_at).toLocaleDateString()}
                {report.last_exported_at && (
                  <> · exported {new Date(report.last_exported_at).toLocaleDateString()}</>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
