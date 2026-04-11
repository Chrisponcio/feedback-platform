'use client'

import { useState, useCallback } from 'react'
import { Button } from '@pulse/ui'
import { QuestionInput, valueToAnswer, type RunnerQuestion } from './question-inputs'
import { getSurveyT, isRtl } from '@/lib/survey-i18n'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SurveyRunnerProps {
  survey: {
    id: string
    title: string
    description?: string | null
    thank_you_message?: string | null
    redirect_url?: string | null
    questions: RunnerQuestion[]
  }
  distributionToken: string
  channel: string
  locale: string
}

type RunnerState = 'intro' | 'questions' | 'submitting' | 'done' | 'error'

// ── Component ─────────────────────────────────────────────────────────────────

export function SurveyRunner({ survey, distributionToken, locale }: SurveyRunnerProps) {
  const t   = getSurveyT(locale)
  const rtl = isRtl(locale)

  const questions = survey.questions
  const [state, setState] = useState<RunnerState>(
    questions.length === 0 ? 'done' : 'intro'
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [sessionId] = useState(() => crypto.randomUUID())
  const [startedAt] = useState(() => new Date().toISOString())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0

  const handleAnswer = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  function canAdvance() {
    if (!currentQuestion) return false
    const val = answers[currentQuestion.id]
    if (!currentQuestion.is_required) return true
    if (val === null || val === undefined || val === '') return false
    return true
  }

  async function handleSubmit() {
    setState('submitting')

    const answerPayload = questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => valueToAnswer(q, answers[q.id]))

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distribution_token: distributionToken,
          session_id: sessionId,
          answers: answerPayload,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          language: locale,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      if (survey.redirect_url) {
        window.location.href = survey.redirect_url
        return
      }

      setState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.')
      setState('error')
    }
  }

  function handleNext() {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      void handleSubmit()
    }
  }

  function handleBack() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  // ── Intro screen ─────────────────────────────────────────────────────────────

  if (state === 'intro') {
    return (
      <Shell rtl={rtl}>
        <div className="space-y-6 text-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{survey.title}</h1>
            {survey.description && (
              <p className="mt-2 text-muted-foreground">{survey.description}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} · Takes about a minute
          </p>
          <Button className="w-full" onClick={() => setState('questions')}>
            {t.start}
          </Button>
        </div>
      </Shell>
    )
  }

  // ── Done screen ───────────────────────────────────────────────────────────────

  if (state === 'done') {
    return (
      <Shell rtl={rtl}>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t.thank_you}</h1>
            <p className="mt-2 text-muted-foreground">
              {survey.thank_you_message ?? t.thank_you}
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Error screen ──────────────────────────────────────────────────────────────

  if (state === 'error') {
    return (
      <Shell rtl={rtl}>
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={() => setState('questions')}>
            Try again
          </Button>
        </div>
      </Shell>
    )
  }

  // ── Question screen ───────────────────────────────────────────────────────────

  if (!currentQuestion) return null

  const isLast = currentIndex === totalQuestions - 1

  return (
    <Shell rtl={rtl}>
      {/* Progress bar */}
      <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question counter */}
      <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {t.question_of(currentIndex + 1, totalQuestions)}
      </p>

      {/* Question */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold leading-snug">
            {currentQuestion.title}
            {currentQuestion.is_required && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </h2>
          {currentQuestion.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {currentQuestion.description}
            </p>
          )}
        </div>

        <QuestionInput
          question={currentQuestion}
          value={answers[currentQuestion.id] ?? null}
          onChange={(val) => handleAnswer(currentQuestion.id, val)}
          locale={locale}
        />
      </div>

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        {currentIndex > 0 && (
          <Button variant="outline" className="flex-1" onClick={handleBack}>
            {t.back}
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={handleNext}
          disabled={!canAdvance() || state === 'submitting'}
        >
          {state === 'submitting'
            ? t.submitting
            : isLast
              ? t.submit
              : t.next}
        </Button>
      </div>

      {/* Skip for optional questions */}
      {!currentQuestion.is_required && answers[currentQuestion.id] === undefined && (
        <button
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={handleNext}
        >
          {t.skip}
        </button>
      )}
    </Shell>
  )
}

// ── Shell wrapper ─────────────────────────────────────────────────────────────

function Shell({ children, rtl }: { children: React.ReactNode; rtl: boolean }) {
  return (
    <div
      className="flex min-h-svh items-center justify-center p-6"
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-lg">{children}</div>
    </div>
  )
}
