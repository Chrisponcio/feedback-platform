'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@pulse/ui'
import { createSurvey } from '@/lib/survey-actions'

interface Survey {
  id: string
  title: string
  status: string
  survey_type: string
  language: string
  created_at: string
  updated_at: string
}

interface SurveyListProps {
  surveys: Survey[]
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  closed:    'bg-red-100 text-red-700',
  archived:  'bg-muted text-muted-foreground',
}

export function SurveyList({ surveys }: SurveyListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    startTransition(async () => {
      const result = await createSurvey()
      if (result.surveyId) {
        router.push(`/surveys/${result.surveyId}/build`)
      }
    })
  }

  if (surveys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
        <h3 className="mb-1 text-lg font-semibold">No surveys yet</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Create your first survey to start collecting feedback.
        </p>
        <Button onClick={handleCreate} disabled={isPending}>
          {isPending ? 'Creating…' : 'Create survey'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
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
  )
}
