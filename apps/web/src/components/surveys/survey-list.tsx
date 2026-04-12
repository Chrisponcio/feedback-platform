'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@pulse/ui'
import { createSurvey } from '@/lib/survey-actions'
import { TemplatePicker } from './template-picker'

interface Survey {
  id: string
  title: string
  status: string
  survey_type: string
  language: string
  created_at: string
  updated_at: string
}

interface Template {
  id: string
  name: string
  description: string | null
  survey_type: string
  is_system: boolean
}

interface SurveyListProps {
  surveys: Survey[]
  templates: Template[]
  canCreate: boolean
}

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-muted text-muted-foreground',
  active:   'bg-green-100 text-green-700',
  paused:   'bg-yellow-100 text-yellow-700',
  closed:   'bg-red-100 text-red-700',
  archived: 'bg-muted text-muted-foreground',
}

export function SurveyList({ surveys, templates, canCreate }: SurveyListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showTemplates, setShowTemplates] = useState(false)

  function handleCreate() {
    startTransition(async () => {
      const result = await createSurvey()
      if (result.surveyId) router.push(`/surveys/${result.surveyId}/build`)
    })
  }

  if (surveys.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
          <h3 className="mb-1 text-lg font-semibold">No surveys yet</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Create your first survey to start collecting feedback.
          </p>
          {canCreate && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowTemplates(true)}>
                Use a template
              </Button>
              <Button onClick={handleCreate} disabled={isPending}>
                {isPending ? 'Creating…' : 'Blank survey'}
              </Button>
            </div>
          )}
        </div>
        {showTemplates && (
          <TemplatePicker templates={templates} onClose={() => setShowTemplates(false)} />
        )}
      </>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {canCreate && (
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
              Use template
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Creating…' : 'New survey'}
            </Button>
          </div>
        )}
        {surveys.map((survey) => (
          <div
            key={survey.id}
            className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            onClick={() => router.push(`/surveys/${survey.id}/build`)}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{survey.title}</p>
              <p className="text-xs text-muted-foreground">
                {survey.survey_type} · {new Date(survey.updated_at).toLocaleDateString()}
              </p>
            </div>
            <span
              className={[
                'ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                STATUS_STYLES[survey.status] ?? STATUS_STYLES.draft,
              ].join(' ')}
            >
              {survey.status}
            </span>
          </div>
        ))}
      </div>
      {showTemplates && (
        <TemplatePicker templates={templates} onClose={() => setShowTemplates(false)} />
      )}
    </>
  )
}
