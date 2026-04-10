'use client'

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

export function SurveyList({ surveys }: SurveyListProps) {
  if (surveys.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center text-muted-foreground">
        No surveys yet — survey builder coming in Phase 1
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-6 text-muted-foreground">
      Survey list ({surveys.length} surveys) — coming in Phase 1
    </div>
  )
}
