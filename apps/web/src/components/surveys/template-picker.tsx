'use client'

import { useState, useTransition } from 'react'
import { createSurveyFromTemplate } from '@/lib/template-actions'

interface Template {
  id: string
  name: string
  description: string | null
  survey_type: string
  is_system: boolean
}

interface TemplatePickerProps {
  templates: Template[]
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  nps:   'NPS',
  csat:  'CSAT',
  mixed: 'Mixed',
  pulse: 'Pulse',
  event: 'Event',
}

const TYPE_COLORS: Record<string, string> = {
  nps:   'bg-blue-100 text-blue-800',
  csat:  'bg-purple-100 text-purple-800',
  mixed: 'bg-orange-100 text-orange-800',
  pulse: 'bg-green-100 text-green-800',
  event: 'bg-pink-100 text-pink-800',
}

export function TemplatePicker({ templates, onClose }: TemplatePickerProps) {
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string | null>(null)

  function handleUse(templateId: string) {
    setSelected(templateId)
    startTransition(async () => {
      await createSurveyFromTemplate(templateId)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold">Start from a template</h2>
            <p className="text-sm text-muted-foreground">Choose a pre-built survey to get started quickly</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-md p-1.5 hover:bg-accent">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleUse(t.id)}
              disabled={isPending}
              className={[
                'text-left rounded-lg border p-4 hover:border-primary transition-colors disabled:opacity-50',
                selected === t.id ? 'border-primary bg-primary/5' : '',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm">{t.name}</h3>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${TYPE_COLORS[t.survey_type] ?? 'bg-muted text-muted-foreground'}`}>
                  {TYPE_LABELS[t.survey_type] ?? t.survey_type}
                </span>
              </div>
              {t.description && (
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {t.description}
                </p>
              )}
              {selected === t.id && isPending && (
                <p className="mt-2 text-xs text-primary">Creating survey…</p>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t text-right">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Start blank survey instead
          </button>
        </div>
      </div>
    </div>
  )
}
