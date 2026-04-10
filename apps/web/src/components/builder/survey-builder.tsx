'use client'

interface Question {
  position: number
  [key: string]: unknown
}

interface SurveyBuilderProps {
  survey: Record<string, unknown> & { questions: Question[] }
}

export function SurveyBuilder({ survey }: SurveyBuilderProps) {
  return (
    <div className="rounded-lg border p-8 text-center text-muted-foreground">
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {survey.title as string}
      </h2>
      <p>Survey builder with drag-and-drop — coming in Phase 1</p>
    </div>
  )
}
