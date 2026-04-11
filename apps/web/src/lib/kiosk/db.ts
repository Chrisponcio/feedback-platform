/**
 * Kiosk offline database (IndexedDB via Dexie)
 *
 * Tables:
 *   pendingResponses — responses queued while offline (matches /api/submit/batch schema)
 *   kioskConfig     — device-level settings (idle timeout, brightness, etc.)
 *   surveyCache     — full survey bundle JSON
 *   syncLog         — audit trail of sync attempts
 */

import Dexie, { type Table } from 'dexie'

/** Matches /api/submit/batch answer schema */
export interface ApiAnswer {
  question_id: string
  question_type: string
  value_numeric?: number | null
  value_text?: string | null
  value_boolean?: boolean | null
  value_json?: unknown | null
}

/** Matches /api/submit/batch per-response schema */
export interface PendingResponse {
  id?: number                     // auto-increment
  distribution_token: string      // for routing + Authorization header
  session_id: string              // UUID idempotency key
  started_at: string              // ISO
  completed_at: string            // ISO
  language: string
  answers: ApiAnswer[]
  metadata?: Record<string, unknown>
  retry_count: number
  created_at: string              // ISO
}

/** User-facing answer state inside the kiosk UI (pre-transform) */
export interface AnswerPayload {
  questionId: string
  questionType: string
  npsScore?: number | null
  csatScore?: number | null
  starRating?: number | null
  textAnswer?: string | null
  choiceAnswer?: string | null
  booleanAnswer?: boolean | null
}

/** Convert UI answer payload to API format */
export function toApiAnswer(a: AnswerPayload): ApiAnswer {
  const base: ApiAnswer = { question_id: a.questionId, question_type: a.questionType }
  if (a.npsScore !== undefined) return { ...base, value_numeric: a.npsScore }
  if (a.csatScore !== undefined) return { ...base, value_numeric: a.csatScore }
  if (a.starRating !== undefined) return { ...base, value_numeric: a.starRating }
  if (a.textAnswer !== undefined) return { ...base, value_text: a.textAnswer }
  if (a.choiceAnswer !== undefined) return { ...base, value_text: a.choiceAnswer }
  if (a.booleanAnswer !== undefined) return { ...base, value_boolean: a.booleanAnswer }
  return base
}

export interface KioskConfig {
  id?: number
  token: string               // distribution token — one row per kiosk
  idleTimeoutSeconds: number
  brightnessPercent?: number
  updatedAt: string
}

export interface SurveyCache {
  id?: number
  token: string               // distribution token
  bundle: string              // JSON string of KioskBundle
  etag: string
  cachedAt: string
}

export interface SyncLogEntry {
  id?: number
  session_id: string
  status: 'success' | 'error' | 'skipped'
  message?: string
  synced_at: string
}

class KioskDatabase extends Dexie {
  pendingResponses!: Table<PendingResponse>
  kioskConfig!: Table<KioskConfig>
  surveyCache!: Table<SurveyCache>
  syncLog!: Table<SyncLogEntry>

  constructor() {
    super('pulse-kiosk')

    this.version(1).stores({
      pendingResponses: '++id, session_id, distribution_token, created_at',
      kioskConfig:      '++id, &token',
      surveyCache:      '++id, &token',
      syncLog:          '++id, session_id, synced_at',
    })
  }
}

// Singleton — safe for SSR (DB only opens in browser)
let _db: KioskDatabase | null = null

export function getKioskDb(): KioskDatabase {
  if (!_db) _db = new KioskDatabase()
  return _db
}
