'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableSectionProps {
  id: string
  canEdit: boolean
  onDelete: () => void
  children: React.ReactNode
}

export function SortableSection({ id, canEdit, onDelete, children }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border bg-background"
    >
      {canEdit && (
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="rounded p-1 hover:bg-accent cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4-8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Delete section"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}
