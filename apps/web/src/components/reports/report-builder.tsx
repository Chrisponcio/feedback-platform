'use client'

import { useState, useTransition, useOptimistic } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableSection } from './sortable-section'
import { SectionRenderer } from './section-renderer'
import { updateReport, upsertSection, deleteSection, reorderSections } from '@/lib/report-actions'
import type { TrendPoint, NpsTrendPoint } from '@/lib/analytics-queries'

export type SectionType = 'chart' | 'metric' | 'table' | 'text'

export interface ReportSection {
  id: string
  type: SectionType
  position: number
  config: Record<string, unknown>
}

interface Report {
  id: string
  title: string
  description: string | null
  survey_id: string | null
  created_at: string
}

interface ReportBuilderProps {
  report: Report
  initialSections: ReportSection[]
  surveys: { id: string; title: string }[]
  canEdit: boolean
  responseTrend: TrendPoint[]
  npsTrend: NpsTrendPoint[]
}

const SECTION_DEFAULTS: Record<SectionType, Record<string, unknown>> = {
  chart:  { chartType: 'response_trend', days: 30 },
  metric: { metric: 'nps', days: 30 },
  table:  { limit: 20 },
  text:   { content: 'Add your notes here...' },
}

const SECTION_LABELS: Record<SectionType, string> = {
  chart:  'Chart',
  metric: 'Metric card',
  table:  'Responses table',
  text:   'Text block',
}

export function ReportBuilder({
  report,
  initialSections,
  surveys,
  canEdit,
  responseTrend,
  npsTrend,
}: ReportBuilderProps) {
  const [sections, setSections] = useState<ReportSection[]>(initialSections)
  const [title, setTitle]       = useState(report.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [isPending, startTransition]    = useTransition()
  const [exporting, setExporting]       = useState<'csv' | 'pdf' | null>(null)
  const [optimisticSections, updateOptimistic] = useOptimistic(sections)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id)
      const newIdx = prev.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(prev, oldIdx, newIdx).map((s, i) => ({ ...s, position: i }))

      // Persist reorder
      startTransition(async () => {
        await reorderSections(report.id, reordered.map((s) => ({ id: s.id, position: s.position })))
      })

      return reordered
    })
  }

  function handleAddSection(type: SectionType) {
    const position = sections.length
    const tempId = `temp-${Date.now()}`
    const newSection: ReportSection = { id: tempId, type, position, config: SECTION_DEFAULTS[type] }

    setSections((prev) => [...prev, newSection])

    startTransition(async () => {
      const result = await upsertSection(report.id, { type, position, config: SECTION_DEFAULTS[type] })
      if (result?.success && result.id) {
        setSections((prev) => prev.map((s) => s.id === tempId ? { ...s, id: result.id! } : s))
      } else {
        setSections((prev) => prev.filter((s) => s.id !== tempId))
      }
    })
  }

  function handleDeleteSection(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId))
    startTransition(async () => {
      await deleteSection(report.id, sectionId)
    })
  }

  function handleUpdateConfig(sectionId: string, config: Record<string, unknown>) {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, config } : s))
    startTransition(async () => {
      const section = sections.find((s) => s.id === sectionId)
      if (!section) return
      await upsertSection(report.id, { id: sectionId, type: section.type, position: section.position, config })
    })
  }

  function handleTitleBlur() {
    setEditingTitle(false)
    if (title !== report.title) {
      startTransition(async () => {
        await updateReport(report.id, { title })
      })
    }
  }

  async function handleExport(format: 'csv' | 'pdf') {
    setExporting(format)
    try {
      const res = await fetch(`/api/reports/${report.id}/export?format=${format}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.${format === 'pdf' ? 'pdf' : 'csv'}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="text-2xl font-bold tracking-tight bg-transparent border-b-2 border-primary outline-none w-full"
            />
          ) : (
            <h1
              className="text-2xl font-bold tracking-tight cursor-text hover:text-primary/80"
              onClick={() => canEdit && setEditingTitle(true)}
            >
              {title}
            </h1>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {isPending ? 'Saving…' : 'Auto-saved'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void handleExport('csv')}
            disabled={!!exporting}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            onClick={() => void handleExport('pdf')}
            disabled={!!exporting}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex gap-6">
        {/* Sections */}
        <div className="flex-1 min-w-0 space-y-3">
          {optimisticSections.length === 0 && (
            <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              Add sections from the panel on the right to build your report.
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={optimisticSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {optimisticSections.map((section) => (
                <SortableSection
                  key={section.id}
                  id={section.id}
                  canEdit={canEdit}
                  onDelete={() => handleDeleteSection(section.id)}
                >
                  <SectionRenderer
                    section={section}
                    canEdit={canEdit}
                    responseTrend={responseTrend}
                    npsTrend={npsTrend}
                    onUpdateConfig={(config) => handleUpdateConfig(section.id, config)}
                  />
                </SortableSection>
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Add-section panel */}
        {canEdit && (
          <div className="w-48 shrink-0">
            <div className="sticky top-6 rounded-lg border bg-background p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Add section
              </p>
              {(Object.entries(SECTION_LABELS) as [SectionType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => handleAddSection(type)}
                  className="w-full rounded-md border border-dashed px-3 py-2 text-sm text-left hover:border-primary hover:text-primary transition-colors"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
