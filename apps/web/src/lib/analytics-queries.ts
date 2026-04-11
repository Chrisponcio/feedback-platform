/**
 * Analytics query helpers — all run server-side with the user's session
 * (RLS scopes everything to current_organization_id automatically).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@pulse/db'
import type { HeatmapCell } from '@/components/analytics/response-heatmap'

// Accept both the SSR cookie-based client and the service-role client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<Database, any, any>

// ── Trend: daily response count over N days ───────────────────────────────────

export interface TrendPoint {
  date: string   // YYYY-MM-DD
  count: number
}

export async function fetchDailyTrend(
  supabase: Client,
  days: number = 30,
  surveyId?: string
): Promise<TrendPoint[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString()

  let query = supabase
    .from('responses')
    .select('created_at')
    .eq('is_complete', true)
    .gte('created_at', since)

  if (surveyId) query = query.eq('survey_id', surveyId)

  const { data } = await query
  if (!data) return []

  // Bucket by date client-side (avoids needing a DB function)
  const counts = new Map<string, number>()
  for (const row of data as unknown as { created_at: string }[]) {
    const d = row.created_at.slice(0, 10)
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }

  // Fill all days in range
  const result: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    result.push({ date: d, count: counts.get(d) ?? 0 })
  }
  return result
}

// ── Trend: NPS over time (7-day rolling average) ─────────────────────────────

export interface NpsTrendPoint {
  date: string
  nps: number
  count: number
}

export async function fetchNpsTrend(
  supabase: Client,
  days: number = 30
): Promise<NpsTrendPoint[]> {
  const since = new Date(Date.now() - (days + 7) * 86400000).toISOString()

  const { data } = await supabase
    .from('response_answers')
    .select('value_numeric, created_at')
    .eq('question_type', 'nps')
    .gte('created_at', since)
    .not('value_numeric', 'is', null)

  if (!data) return []

  type Row = { value_numeric: number; created_at: string }
  const rows = data as unknown as Row[]

  // Bucket by date
  const byDate = new Map<string, number[]>()
  for (const r of rows) {
    const d = r.created_at.slice(0, 10)
    const arr = byDate.get(d) ?? []
    arr.push(r.value_numeric)
    byDate.set(d, arr)
  }

  const result: NpsTrendPoint[] = []
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    if (d < cutoff) continue

    // 7-day window ending on d
    const window: number[] = []
    for (let j = 6; j >= 0; j--) {
      const wd = new Date(new Date(d).getTime() - j * 86400000).toISOString().slice(0, 10)
      window.push(...(byDate.get(wd) ?? []))
    }
    if (window.length === 0) continue

    const promoters  = window.filter((v) => v >= 9).length
    const detractors = window.filter((v) => v <= 6).length
    const nps = Math.round(((promoters - detractors) / window.length) * 100)
    result.push({ date: d, nps, count: window.length })
  }
  return result
}

// ── Heatmap: response count by day-of-week × hour-of-day ────────────────────

export async function fetchHeatmapData(
  supabase: Client,
  days: number = 90
): Promise<HeatmapCell[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data } = await supabase
    .from('responses')
    .select('created_at')
    .eq('is_complete', true)
    .gte('created_at', since)

  if (!data) return []

  const counts = new Map<string, number>()
  for (const row of data as unknown as { created_at: string }[]) {
    const dt = new Date(row.created_at)
    const key = `${dt.getUTCDay()}-${dt.getUTCHours()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const cells: HeatmapCell[] = []
  counts.forEach((count, key) => {
    const [day, hour] = key.split('-').map(Number)
    cells.push({ day: day!, hour: hour!, count })
  })
  return cells
}

// ── Anomaly detection: z-score vs 30-day baseline ───────────────────────────

export interface AnomalyResult {
  metric: string
  current: number
  baseline: number
  stddev: number
  zScore: number
  isAnomaly: boolean  // |z| > 2
}

export async function detectAnomalies(
  supabase: Client
): Promise<AnomalyResult[]> {
  const results: AnomalyResult[] = []

  // Response count anomaly: compare today vs 30-day daily average
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'

  const { count: todayCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('is_complete', true)
    .gte('created_at', todayStart)

  const { data: historicRows } = await supabase
    .from('responses')
    .select('created_at')
    .eq('is_complete', true)
    .gte('created_at', thirtyDaysAgo)
    .lt('created_at', todayStart)

  if (historicRows && historicRows.length > 0) {
    const byDay = new Map<string, number>()
    for (const r of historicRows as unknown as { created_at: string }[]) {
      const d = r.created_at.slice(0, 10)
      byDay.set(d, (byDay.get(d) ?? 0) + 1)
    }
    const dailyCounts = Array.from(byDay.values())
    const mean = dailyCounts.reduce((s, v) => s + v, 0) / dailyCounts.length
    const variance = dailyCounts.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyCounts.length
    const stddev = Math.sqrt(variance)
    const current = todayCount ?? 0
    const zScore = stddev > 0 ? (current - mean) / stddev : 0

    results.push({
      metric: 'daily_responses',
      current,
      baseline: Math.round(mean),
      stddev: Math.round(stddev * 10) / 10,
      zScore: Math.round(zScore * 10) / 10,
      isAnomaly: Math.abs(zScore) > 2,
    })
  }

  return results
}
