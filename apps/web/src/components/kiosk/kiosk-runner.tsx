'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { IdleScreen } from './idle-screen'
import { useIdleTimeout } from '@/hooks/use-idle-timeout'
import { getKioskDb, toApiAnswer } from '@/lib/kiosk/db'
import type { AnswerPayload } from '@/lib/kiosk/db'

// ── Types ────────────────────────────────────────────────────────────────────

interface KioskQuestion {
  id: string
  type: 'nps' | 'csat' | 'smiley' | 'star_rating' | 'multiple_choice' | 'open_text'
  title: string
  description?: string | null
  is_required: boolean
  position: number
  settings?: {
    options?: string[]
    scale_min?: number
    scale_max?: number
  } | null
}

interface KioskBundle {
  survey: {
    id: string
    title: string
    thank_you_message: string
    redirect_url?: string | null
    branding?: {
      primary_color?: string
      logo_url?: string
      org_name?: string
    } | null
  }
  distribution: {
    token: string
    id: string
  }
  questions: KioskQuestion[]
}

type KioskState = 'idle' | 'survey' | 'submitting' | 'done' | 'error'

interface KioskRunnerProps {
  paramsPromise: Promise<{ token: string }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function newSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Question rendering ───────────────────────────────────────────────────────

function NpsButton({ value, selected, color, onClick }: { value: number; selected: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold transition-all active:scale-95"
      style={{
        background: selected ? color : `${color}22`,
        color: selected ? '#fff' : color,
        border: `2px solid ${color}`,
      }}
    >
      {value}
    </button>
  )
}

function StarButton({ filled, onClick }: { filled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-5xl transition-transform active:scale-90"
      style={{ color: filled ? '#f59e0b' : '#d1d5db' }}
    >
      ★
    </button>
  )
}

const SMILEYS = ['😡', '😕', '😐', '🙂', '😍']
const CSAT_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e']

function npsColor(n: number) {
  return n <= 6 ? '#ef4444' : n <= 8 ? '#f59e0b' : '#22c55e'
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: KioskQuestion
  value: AnswerPayload
  onChange: (v: AnswerPayload) => void
}) {
  const base: AnswerPayload = { questionId: question.id, questionType: question.type }

  if (question.type === 'nps') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: 11 }, (_, i) => (
            <NpsButton
              key={i}
              value={i}
              selected={value.npsScore === i}
              color={npsColor(i)}
              onClick={() => onChange({ ...base, npsScore: i })}
            />
          ))}
        </div>
        <div className="flex w-full max-w-lg justify-between text-sm text-muted-foreground">
          <span>Not at all likely</span>
          <span>Extremely likely</span>
        </div>
      </div>
    )
  }

  if (question.type === 'csat') {
    return (
      <div className="flex justify-center gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange({ ...base, csatScore: n })}
            className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold transition-all active:scale-95"
            style={{
              background: value.csatScore === n ? CSAT_COLORS[n - 1] : `${CSAT_COLORS[n - 1]}22`,
              color: value.csatScore === n ? '#fff' : CSAT_COLORS[n - 1],
              border: `2px solid ${CSAT_COLORS[n - 1]}`,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'smiley') {
    return (
      <div className="flex justify-center gap-6">
        {SMILEYS.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onChange({ ...base, csatScore: i + 1 })}
            className="flex flex-col items-center gap-1 transition-transform active:scale-90"
          >
            <span
              className="text-6xl transition-all"
              style={{
                filter: value.csatScore === i + 1 ? 'none' : 'grayscale(0.6) opacity(0.5)',
              }}
            >
              {emoji}
            </span>
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'star_rating') {
    const max = question.settings?.scale_max ?? 5
    const current = value.starRating ?? 0
    return (
      <div className="flex justify-center gap-2">
        {Array.from({ length: max }, (_, i) => (
          <StarButton
            key={i}
            filled={i < current}
            onClick={() => onChange({ ...base, starRating: i + 1 })}
          />
        ))}
      </div>
    )
  }

  if (question.type === 'multiple_choice') {
    const options = question.settings?.options ?? []
    return (
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange({ ...base, choiceAnswer: opt })}
            className="rounded-xl border-2 px-6 py-4 text-left text-lg font-medium transition-all active:scale-[0.98]"
            style={{
              borderColor: value.choiceAnswer === opt ? '#6366f1' : '#e5e7eb',
              background: value.choiceAnswer === opt ? '#6366f110' : '#fff',
              color: value.choiceAnswer === opt ? '#6366f1' : '#374151',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'open_text') {
    return (
      <textarea
        value={value.textAnswer ?? ''}
        onChange={(e) => onChange({ ...base, textAnswer: e.target.value })}
        placeholder="Type your response here…"
        rows={4}
        className="w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-lg focus:border-primary focus:outline-none"
      />
    )
  }

  return null
}

// ── Main component ────────────────────────────────────────────────────────────

export function KioskRunner({ paramsPromise }: KioskRunnerProps) {
  const { token } = use(paramsPromise)

  const [bundle, setBundle] = useState<KioskBundle | null>(null)
  const [bundleError, setBundleError] = useState<string | null>(null)
  const [state, setState] = useState<KioskState>('idle')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerPayload[]>([])
  const [sessionId, setSessionId] = useState(() => newSessionId())
  const startedAtRef = useRef<string>(new Date().toISOString())

  // ── Load bundle (cache → live) ─────────────────────────────────────────────
  useEffect(() => {
    async function loadBundle() {
      try {
        const db = getKioskDb()
        const cached = await db.surveyCache.where('token').equals(token).first()
        if (cached) setBundle(JSON.parse(cached.bundle) as KioskBundle)
      } catch { /* IndexedDB unavailable in SSR */ }

      try {
        const res = await fetch(`/api/kiosk/bundle?token=${encodeURIComponent(token)}`)
        if (!res.ok) { setBundleError('Survey not found.'); return }
        const data = (await res.json()) as KioskBundle
        setBundle(data)
        try {
          const db = getKioskDb()
          await db.surveyCache.where('token').equals(token).delete()
          await db.surveyCache.add({
            token,
            bundle: JSON.stringify(data),
            etag: res.headers.get('etag') ?? '',
            cachedAt: new Date().toISOString(),
          })
        } catch { /* non-fatal */ }
      } catch {
        if (!bundle) setBundleError('Could not load survey. Check your connection.')
      }
    }
    void loadBundle()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush pending offline responses ───────────────────────────────────────
  useEffect(() => {
    async function flush() {
      try {
        const db = getKioskDb()
        const pending = await db.pendingResponses
          .where('distribution_token').equals(token).toArray()
        for (const resp of pending) {
          try {
            const res = await fetch('/api/submit/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resp.distribution_token}`,
              },
              body: JSON.stringify({
                responses: [{
                  session_id: resp.session_id,
                  started_at: resp.started_at,
                  completed_at: resp.completed_at,
                  language: resp.language,
                  answers: resp.answers,
                }],
              }),
            })
            if (res.ok) {
              await db.pendingResponses.delete(resp.id!)
              await db.syncLog.add({ session_id: resp.session_id, status: 'success', synced_at: new Date().toISOString() })
            }
          } catch { /* will retry */ }
        }
      } catch { /* IndexedDB unavailable */ }
    }

    const handler = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === 'FLUSH_RESPONSES') void flush()
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    void flush()
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [token])

  // ── Idle timeout (60 s) ────────────────────────────────────────────────────
  const doReset = useCallback(() => {
    setState('idle')
    setCurrentIndex(0)
    setAnswers([])
  }, [])

  useIdleTimeout({ timeoutSeconds: 60, onIdle: doReset, enabled: state === 'survey' })

  // ── Handlers ───────────────────────────────────────────────────────────────
  function startSurvey() {
    setSessionId(newSessionId())
    startedAtRef.current = new Date().toISOString()
    setCurrentIndex(0)
    setAnswers([])
    setState('survey')
  }

  function handleAnswer(answer: AnswerPayload) {
    setAnswers((prev) => [
      ...prev.filter((a) => a.questionId !== answer.questionId),
      answer,
    ])
  }

  async function handleNext() {
    const questions = bundle?.questions ?? []
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1)
      return
    }
    await submitResponse()
  }

  async function submitResponse() {
    if (!bundle) return
    setState('submitting')

    const completedAt = new Date().toISOString()
    const apiAnswers = answers.map(toApiAnswer)

    const submitPayload = {
      distribution_token: bundle.distribution.token,
      session_id: sessionId,
      answers: apiAnswers,
      started_at: startedAtRef.current,
      completed_at: completedAt,
      language: 'en',
    }

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      })
      if (res.ok) { setState('done'); setTimeout(doReset, 4000); return }
    } catch { /* offline — fall through to queue */ }

    // Queue for background sync
    try {
      const db = getKioskDb()
      await db.pendingResponses.add({
        distribution_token: bundle.distribution.token,
        session_id: sessionId,
        started_at: startedAtRef.current,
        completed_at: completedAt,
        language: 'en',
        answers: apiAnswers,
        retry_count: 0,
        created_at: new Date().toISOString(),
      })
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready
        await (reg as unknown as { sync: { register(tag: string): Promise<void> } })
          .sync.register('kiosk-responses')
      }
      setState('done')
      setTimeout(doReset, 4000)
    } catch {
      setState('error')
      setTimeout(doReset, 5000)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const accentColor = bundle?.survey.branding?.primary_color ?? '#6366f1'

  if (bundleError) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background text-center">
        <p className="text-5xl">⚠️</p>
        <p className="text-lg font-medium">{bundleError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-xl px-6 py-3 text-sm font-medium text-white"
          style={{ background: accentColor }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!bundle) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }

  if (state === 'idle') {
    return (
      <IdleScreen
        orgName={bundle.survey.branding?.org_name}
        logoUrl={bundle.survey.branding?.logo_url}
        accentColor={accentColor}
        onStart={startSurvey}
      />
    )
  }

  if (state === 'done') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-background text-center">
        <div className="text-7xl">🙏</div>
        <p className="text-3xl font-bold">{bundle.survey.thank_you_message}</p>
        <p className="text-muted-foreground">Returning to start in a moment…</p>
      </div>
    )
  }

  if (state === 'submitting') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-lg text-muted-foreground">Saving your response…</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background text-center">
        <p className="text-5xl">📡</p>
        <p className="text-xl font-semibold">Saved for later</p>
        <p className="text-muted-foreground">Your response will sync when connected.</p>
      </div>
    )
  }

  // ── Survey ─────────────────────────────────────────────────────────────────
  const questions = bundle.questions
  const question = questions[currentIndex]
  if (!question) return null

  const currentAnswer: AnswerPayload = answers.find((a) => a.questionId === question.id) ?? {
    questionId: question.id,
    questionType: question.type,
  }
  const hasAnswer =
    currentAnswer.npsScore !== undefined ||
    currentAnswer.csatScore !== undefined ||
    currentAnswer.starRating !== undefined ||
    !!currentAnswer.textAnswer ||
    !!currentAnswer.choiceAnswer
  const canAdvance = !question.is_required || hasAnswer
  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Progress */}
      <div className="h-1.5 w-full bg-muted">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: accentColor }}
        />
      </div>

      {/* Question */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-8 py-12">
        <div className="w-full max-w-2xl">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {currentIndex + 1} of {questions.length}
          </p>
          <h2 className="mb-2 text-center text-2xl font-bold leading-snug">
            {question.title}
          </h2>
          {question.description && (
            <p className="mb-8 text-center text-base text-muted-foreground">
              {question.description}
            </p>
          )}
          <QuestionInput question={question} value={currentAnswer} onChange={handleAnswer} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t bg-background px-8 py-4">
        <button
          onClick={() => (currentIndex === 0 ? doReset() : setCurrentIndex((i) => i - 1))}
          className="rounded-xl border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          {currentIndex === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          onClick={handleNext}
          disabled={!canAdvance}
          className="rounded-xl px-8 py-3 text-base font-semibold text-white transition-all disabled:opacity-40 active:scale-95"
          style={{ background: canAdvance ? accentColor : '#9ca3af' }}
        >
          {currentIndex === questions.length - 1 ? 'Submit' : 'Next'}
        </button>
      </div>
    </div>
  )
}
