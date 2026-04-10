'use client'

import { Button } from '@pulse/ui'
import type { QuestionType } from '@/stores/builder-store'

const QUESTION_TYPES: { type: QuestionType; label: string; description: string }[] = [
  { type: 'nps',             label: 'NPS',             description: '0–10 scale' },
  { type: 'csat',            label: 'CSAT',            description: '1–5 scale' },
  { type: 'smiley',          label: 'Smiley',          description: '5 face scale' },
  { type: 'star_rating',     label: 'Star Rating',     description: '1–5 stars' },
  { type: 'multiple_choice', label: 'Multiple Choice', description: 'Pick one or many' },
  { type: 'open_text',       label: 'Open Text',       description: 'Free-form answer' },
]

interface QuestionTypePickerProps {
  onSelect: (type: QuestionType) => void
}

export function QuestionTypePicker({ onSelect }: QuestionTypePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {QUESTION_TYPES.map(({ type, label, description }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="flex flex-col items-start rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent"
        >
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </button>
      ))}
    </div>
  )
}
