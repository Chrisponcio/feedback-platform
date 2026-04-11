'use client'

import { useState } from 'react'
import { NpsTrendChart } from '@/components/analytics/nps-trend-chart'
import { ResponseTrendChart } from '@/components/analytics/response-trend-chart'
import type { ReportSection } from './report-builder'
import type { TrendPoint, NpsTrendPoint } from '@/lib/analytics-queries'

interface SectionRendererProps {
  section: ReportSection
  canEdit: boolean
  responseTrend: TrendPoint[]
  npsTrend: NpsTrendPoint[]
  onUpdateConfig: (config: Record<string, unknown>) => void
}

export function SectionRenderer({
  section,
  canEdit,
  responseTrend,
  npsTrend,
  onUpdateConfig,
}: SectionRendererProps) {
  if (section.type === 'chart')  return <ChartSection  section={section} canEdit={canEdit} responseTrend={responseTrend} npsTrend={npsTrend} onUpdate={onUpdateConfig} />
  if (section.type === 'metric') return <MetricSection section={section} canEdit={canEdit} onUpdate={onUpdateConfig} />
  if (section.type === 'table')  return <TableSection  section={section} canEdit={canEdit} onUpdate={onUpdateConfig} />
  if (section.type === 'text')   return <TextSection   section={section} canEdit={canEdit} onUpdate={onUpdateConfig} />
  return null
}

// ── Chart section ─────────────────────────────────────────────────────────────

interface ChartProps {
  section: ReportSection
  canEdit: boolean
  responseTrend: TrendPoint[]
  npsTrend: NpsTrendPoint[]
  onUpdate: (c: Record<string, unknown>) => void
}

const CHART_TYPE_LABELS = {
  response_trend: 'Daily Responses (30d)',
  nps_trend:      'NPS Trend — 7-day rolling (30d)',
}

function ChartSection({ section, canEdit, responseTrend, npsTrend, onUpdate }: ChartProps) {
  const chartType = (section.config.chartType as keyof typeof CHART_TYPE_LABELS) ?? 'response_trend'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{CHART_TYPE_LABELS[chartType] ?? chartType}</h3>
        {canEdit && (
          <select
            value={chartType}
            onChange={(e) => onUpdate({ ...section.config, chartType: e.target.value })}
            className="text-xs rounded border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="response_trend">Daily Responses</option>
            <option value="nps_trend">NPS Trend</option>
          </select>
        )}
      </div>
      {chartType === 'response_trend' && <ResponseTrendChart data={responseTrend} />}
      {chartType === 'nps_trend'      && <NpsTrendChart data={npsTrend} />}
    </div>
  )
}

// ── Metric section ────────────────────────────────────────────────────────────

interface MetricProps {
  section: ReportSection
  canEdit: boolean
  onUpdate: (c: Record<string, unknown>) => void
}

const METRIC_LABELS: Record<string, string> = {
  nps:             'NPS Score',
  csat:            'CSAT Average',
  response_count:  'Total Responses',
  completion_rate: 'Completion Rate',
}

function MetricSection({ section, canEdit, onUpdate }: MetricProps) {
  const metric = (section.config.metric as string) ?? 'nps'

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{METRIC_LABELS[metric] ?? metric}</p>
        <p className="text-4xl font-bold mt-1 text-muted-foreground/40">—</p>
        <p className="text-xs text-muted-foreground mt-1">Live data in exported view</p>
      </div>
      {canEdit && (
        <select
          value={metric}
          onChange={(e) => onUpdate({ ...section.config, metric: e.target.value })}
          className="text-xs rounded border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary self-start"
        >
          {Object.entries(METRIC_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ── Table section ─────────────────────────────────────────────────────────────

interface TableProps {
  section: ReportSection
  canEdit: boolean
  onUpdate: (c: Record<string, unknown>) => void
}

function TableSection({ section, canEdit, onUpdate }: TableProps) {
  const limit = (section.config.limit as number) ?? 20

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Recent Responses</h3>
        {canEdit && (
          <select
            value={limit}
            onChange={(e) => onUpdate({ ...section.config, limit: parseInt(e.target.value, 10) })}
            className="text-xs rounded border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="10">10 rows</option>
            <option value="20">20 rows</option>
            <option value="50">50 rows</option>
          </select>
        )}
      </div>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Channel</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                Data populated on export
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Text section ──────────────────────────────────────────────────────────────

interface TextProps {
  section: ReportSection
  canEdit: boolean
  onUpdate: (c: Record<string, unknown>) => void
}

function TextSection({ section, canEdit, onUpdate }: TextProps) {
  const [editing, setEditing] = useState(false)
  const content = (section.config.content as string) ?? ''

  if (editing && canEdit) {
    return (
      <textarea
        autoFocus
        defaultValue={content}
        onBlur={(e) => {
          setEditing(false)
          onUpdate({ ...section.config, content: e.target.value })
        }}
        className="w-full min-h-[80px] bg-transparent text-sm resize-none focus:outline-none"
        placeholder="Add your notes..."
      />
    )
  }

  return (
    <p
      className={`text-sm whitespace-pre-wrap ${canEdit ? 'cursor-text hover:text-primary/80' : ''} ${!content ? 'text-muted-foreground' : ''}`}
      onClick={() => canEdit && setEditing(true)}
    >
      {content || 'Click to add text…'}
    </p>
  )
}
