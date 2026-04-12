'use client'

import { useState } from 'react'
import { NpsScale, SmileyRater } from '@pulse/ui'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RunnerQuestion {
  id: string
  type: string
  title: string
  description: string | null
  is_required: boolean
  settings: Record<string, unknown> | null
  logic?: import('@/lib/logic-evaluator').LogicConfig | null
  media_url?: string | null
  media_type?: string | null
}

interface InputProps {
  question: RunnerQuestion
  value: unknown
  onChange: (value: unknown) => void
  locale?: string
}

// ── Star Rating ────────────────────────────────────────────────────────────────

function StarInput({ question, value, onChange }: InputProps) {
  const min = (question.settings?.scale_min as number) ?? 1
  const max = (question.settings?.scale_max as number) ?? 5
  const stars = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  const [hovered, setHovered] = useState<number | null>(null)
  const current = (value as number | null) ?? null

  return (
    <div className="flex justify-center gap-2">
      {stars.map((s) => {
        const filled = (hovered ?? current ?? -1) >= s
        return (
          <button
            key={s}
            type="button"
            aria-label={`${s} star${s !== 1 ? 's' : ''}`}
            onClick={() => onChange(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
            className="text-3xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={filled ? 'text-amber-400' : 'text-muted-foreground/30'}>★</span>
          </button>
        )
      })}
    </div>
  )
}

// ── CSAT 1–5 scale ────────────────────────────────────────────────────────────

function CsatInput({ value, onChange }: InputProps) {
  const options = [
    { v: 1, label: '1', color: 'bg-red-500 text-white' },
    { v: 2, label: '2', color: 'bg-orange-400 text-white' },
    { v: 3, label: '3', color: 'bg-amber-400 text-amber-900' },
    { v: 4, label: '4', color: 'bg-lime-500 text-white' },
    { v: 5, label: '5', color: 'bg-emerald-500 text-white' },
  ]
  const current = value as number | null

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2">
        {options.map(({ v, label, color }) => (
          <button
            key={v}
            type="button"
            aria-label={`${v} out of 5`}
            onClick={() => onChange(v)}
            className={[
              'flex h-12 w-12 items-center justify-center rounded-lg border-2 text-lg font-bold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              current === v ? `${color} scale-110 shadow-md border-transparent` : 'border-border hover:scale-105',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-1 text-xs text-muted-foreground">
        <span>Very dissatisfied</span>
        <span>Very satisfied</span>
      </div>
    </div>
  )
}

// ── Multiple Choice ────────────────────────────────────────────────────────────

function MultipleChoiceInput({ question, value, onChange }: InputProps) {
  const options = (question.settings?.options as { id: string; label: string }[]) ?? []
  const current = value as string | null

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={[
            'w-full rounded-lg border-2 px-4 py-3 text-left text-sm transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            current === opt.id
              ? 'border-primary bg-primary/5 font-medium'
              : 'border-border hover:border-primary/50 hover:bg-accent/50',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Open Text ─────────────────────────────────────────────────────────────────

function OpenTextInput({ question, value, onChange, locale }: InputProps) {
  const placeholder = locale === 'es'
    ? 'Escribe tu respuesta aquí…'
    : locale === 'ar'
      ? 'اكتب ردك هنا…'
      : 'Type your answer here…'
  return (
    <textarea
      rows={4}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.description ?? placeholder}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    />
  )
}

// ── Media (image/video) question ──────────────────────────────────────────────

function MediaQuestionInput({ question, value, onChange }: InputProps) {
  const mediaUrl = question.media_url
  const mediaType = question.media_type ?? 'image'
  const [uploading, setUploading] = useState(false)

  // Display media prompt (image or video)
  const mediaElement = mediaUrl ? (
    mediaType === 'video' ? (
      <video
        src={mediaUrl}
        controls
        className="mx-auto mb-4 max-h-64 rounded-lg"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaUrl}
        alt="Question media"
        className="mx-auto mb-4 max-h-64 rounded-lg object-contain"
      />
    )
  ) : null

  // File upload response (user uploads image/video as their answer)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json() as { url: string }
      onChange(url)
    } catch {
      // Allow retry
    } finally {
      setUploading(false)
    }
  }

  const currentUrl = value as string | null

  return (
    <div className="space-y-4">
      {mediaElement}

      {/* If it's a response-upload type media question */}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50 hover:bg-accent/30">
        <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-sm text-muted-foreground">
          {uploading ? 'Uploading...' : currentUrl ? 'Replace file' : 'Upload a file'}
        </span>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="sr-only"
          disabled={uploading}
        />
      </label>

      {currentUrl && (
        <p className="text-center text-xs text-emerald-600">File uploaded successfully</p>
      )}
    </div>
  )
}

// ── Dispatcher ─────────────────────────────────────────────────────────────────

export function QuestionInput({ question, value, onChange, locale }: InputProps) {
  switch (question.type) {
    case 'nps':
      return (
        <NpsScale
          value={value as number | null}
          onChange={onChange}
          size="md"
        />
      )
    case 'csat':
      return <CsatInput question={question} value={value} onChange={onChange} />
    case 'smiley':
      return (
        <SmileyRater
          value={value as number | null}
          onChange={onChange}
          size="md"
        />
      )
    case 'star_rating':
      return <StarInput question={question} value={value} onChange={onChange} />
    case 'multiple_choice':
      return <MultipleChoiceInput question={question} value={value} onChange={onChange} />
    case 'open_text':
      return <OpenTextInput question={question} value={value} onChange={onChange} locale={locale} />
    case 'media_question':
      return <MediaQuestionInput question={question} value={value} onChange={onChange} />
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Unsupported question type: {question.type}
        </p>
      )
  }
}

// ── Helpers: value → answer payload ───────────────────────────────────────────

export function valueToAnswer(question: RunnerQuestion, value: unknown) {
  const base = {
    question_id: question.id,
    question_type: question.type,
    value_numeric: null as number | null,
    value_text: null as string | null,
    value_boolean: null as boolean | null,
    value_json: null as unknown,
  }

  switch (question.type) {
    case 'nps':
    case 'csat':
    case 'star_rating':
      return { ...base, value_numeric: value as number }
    case 'smiley':
      return { ...base, value_numeric: value as number }
    case 'open_text':
      return { ...base, value_text: value as string }
    case 'multiple_choice':
      return { ...base, value_json: value }
    case 'media_question':
      return { ...base, value_text: value as string } // stored as URL
    default:
      return { ...base, value_json: value }
  }
}
