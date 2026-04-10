'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useBuilderStore, type BuilderQuestion } from '@/stores/builder-store'

const TYPE_LABEL: Record<string, string> = {
  nps: 'NPS',
  csat: 'CSAT',
  smiley: 'Smiley',
  open_text: 'Open Text',
  multiple_choice: 'Multiple Choice',
  star_rating: 'Star Rating',
}

interface SortableQuestionCardProps {
  question: BuilderQuestion
  isSelected: boolean
}

export function SortableQuestionCard({ question, isSelected }: SortableQuestionCardProps) {
  const { selectQuestion, removeQuestion } = useBuilderStore((s) => ({
    selectQuestion: s.selectQuestion,
    removeQuestion: s.removeQuestion,
  }))

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group flex items-start gap-2 rounded-lg border bg-card p-3 cursor-pointer transition-colors',
        isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground/40',
        isDragging ? 'shadow-lg' : '',
      ].join(' ')}
      onClick={() => selectQuestion(question.id)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2" />
          <circle cx="4" cy="7" r="1.2" />
          <circle cx="4" cy="11" r="1.2" />
          <circle cx="10" cy="3" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
          <circle cx="10" cy="11" r="1.2" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {TYPE_LABEL[question.type] ?? question.type}
          </span>
          {question.required && (
            <span className="text-[10px] text-destructive">Required</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium">
          {question.title || <span className="text-muted-foreground italic">Untitled</span>}
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); removeQuestion(question.id) }}
        className="mt-0.5 text-muted-foreground/0 transition-opacity group-hover:text-muted-foreground/60 hover:!text-destructive"
        aria-label="Remove question"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </div>
  )
}
