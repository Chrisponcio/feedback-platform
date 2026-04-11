import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ reportId: string }>
}

/**
 * GET /api/reports/:reportId/export?format=csv|pdf
 *
 * CSV: streamed download via xlsx
 * PDF: headless Chromium via @sparticuz/chromium + puppeteer-core
 */
export async function GET(request: NextRequest, { params }: PageProps) {
  const { reportId } = await params
  const format = request.nextUrl.searchParams.get('format') ?? 'csv'

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const serviceClient = createServiceRoleClient()

  const { data: report } = await serviceClient
    .from('reports')
    .select('id, title, survey_id')
    .eq('id', reportId)
    .eq('organization_id', orgId)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type ReportRow = { id: string; title: string; survey_id: string | null }
  const reportData = report as unknown as ReportRow

  // Fetch responses for this report (org-scoped, survey-filtered if set)
  let query = serviceClient
    .from('responses')
    .select('id, created_at, channel, language, is_complete, started_at, completed_at, duration_seconds, device_type')
    .eq('organization_id', orgId)
    .eq('is_complete', true)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (reportData.survey_id) {
    query = query.eq('survey_id', reportData.survey_id)
  }

  const { data: responses } = await query
  const rows = (responses as unknown as Record<string, unknown>[] | null) ?? []

  if (format === 'csv') {
    return exportCsv(reportData.title, rows, serviceClient)
  }

  if (format === 'pdf') {
    return exportPdf(reportData, rows, request)
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
}

// ── CSV export ────────────────────────────────────────────────────────────────

async function exportCsv(
  title: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, unknown>[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _serviceClient: any
): Promise<NextResponse> {
  const xlsx = await import('xlsx')

  const headers = ['id', 'created_at', 'channel', 'language', 'is_complete', 'started_at', 'completed_at', 'duration_seconds', 'device_type']

  const wsData = [
    headers,
    ...rows.map((row) => headers.map((h) => row[h] ?? '')),
  ]

  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.aoa_to_sheet(wsData)
  xlsx.utils.book_append_sheet(wb, ws, 'Responses')

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'csv' }) as Uint8Array

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(title)}.csv"`,
    },
  })
}

// ── PDF export ────────────────────────────────────────────────────────────────

async function exportPdf(
  report: { id: string; title: string },
  rows: Record<string, unknown>[],
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Dynamic import to avoid bundling in non-PDF paths
    const chromium = await import('@sparticuz/chromium').then((m) => m.default)
    const puppeteer = await import('puppeteer-core').then((m) => m.default)

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })

    const page = await browser.newPage()

    // Build simple HTML for the report
    const tableRows = rows.slice(0, 100).map((row) => `
      <tr>
        <td>${String(row.created_at ?? '').slice(0, 10)}</td>
        <td>${row.channel ?? ''}</td>
        <td>${row.language ?? ''}</td>
        <td>${row.duration_seconds ?? ''}s</td>
        <td>${row.device_type ?? ''}</td>
      </tr>
    `).join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, sans-serif; padding: 40px; color: #111; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          p { color: #666; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; padding: 8px 12px; background: #f4f4f5; border-bottom: 1px solid #e4e4e7; font-weight: 600; }
          td { padding: 8px 12px; border-bottom: 1px solid #f4f4f5; }
          .footer { margin-top: 32px; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <h1>${report.title}</h1>
        <p>Exported ${new Date().toLocaleDateString()} · ${rows.length} responses</p>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Channel</th><th>Language</th><th>Duration</th><th>Device</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${rows.length > 100 ? `<p class="footer">Showing first 100 of ${rows.length} rows</p>` : ''}
        <p class="footer">Generated by Pulse · ${request.headers.get('host') ?? ''}</p>
      </body>
      </html>
    `

    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    await browser.close()

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(report.title)}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF export failed:', err)
    return NextResponse.json({ error: 'PDF export unavailable in this environment' }, { status: 503 })
  }
}
