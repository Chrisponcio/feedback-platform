'use client'

interface Question {
  position: number
  [key: string]: unknown
}

interface SurveyRunnerProps {
  survey: Record<string, unknown> & { questions: Question[] }
  distributionId: string
  channel: string
  locale: string
}

export function SurveyRunner({ survey }: SurveyRunnerProps) {
  const questionCount = survey.questions?.length ?? 0

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-lg border p-8 text-center text-muted-foreground">
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          {survey.title as string}
        </h2>
        <p>{questionCount} question{questionCount !== 1 ? 's' : ''} — survey runner coming in Phase 1</p>
      </div>
    </div>
  )
}
