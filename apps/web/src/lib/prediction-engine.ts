/**
 * Predictive analytics engine — generates churn risk, satisfaction trend,
 * and response volume forecasts based on historical data patterns.
 *
 * Uses statistical models (linear regression, moving averages, z-scores)
 * rather than external ML services to keep the system self-contained.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

interface PredictionResult {
  prediction_type: 'churn_risk' | 'satisfaction_trend' | 'response_volume_forecast'
  score: number       // 0–100
  confidence: number  // 0–1
  factors: { name: string; impact: number; description: string }[]
  period_start: string
  period_end: string
}

export async function generatePredictions(
  supabase: SupabaseClient,
  orgId: string
): Promise<PredictionResult[]> {
  const results: PredictionResult[] = []
  const now = new Date()
  const periodStart = now.toISOString().slice(0, 10)
  const periodEnd = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)

  const [churn, satisfaction, volume] = await Promise.all([
    computeChurnRisk(supabase, orgId),
    computeSatisfactionTrend(supabase, orgId),
    computeVolumeForecast(supabase, orgId),
  ])

  if (churn) results.push({ ...churn, period_start: periodStart, period_end: periodEnd })
  if (satisfaction) results.push({ ...satisfaction, period_start: periodStart, period_end: periodEnd })
  if (volume) results.push({ ...volume, period_start: periodStart, period_end: periodEnd })

  return results
}

// ── Churn risk ──────────────────────────────────────────────────────────────

async function computeChurnRisk(
  supabase: SupabaseClient,
  orgId: string
): Promise<Omit<PredictionResult, 'period_start' | 'period_end'> | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()

  // Get NPS scores for last 30d and previous 30d
  const [{ data: recentNps }, { data: prevNps }, { count: recentResponses }, { count: prevResponses }] = await Promise.all([
    supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('question_type', 'nps')
      .gte('created_at', thirtyDaysAgo)
      .not('value_numeric', 'is', null),
    supabase
      .from('response_answers')
      .select('value_numeric')
      .eq('question_type', 'nps')
      .gte('created_at', sixtyDaysAgo)
      .lt('created_at', thirtyDaysAgo)
      .not('value_numeric', 'is', null),
    supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_complete', true)
      .gte('created_at', thirtyDaysAgo),
    supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_complete', true)
      .gte('created_at', sixtyDaysAgo)
      .lt('created_at', thirtyDaysAgo),
  ])

  type NumRow = { value_numeric: number }
  const recent = ((recentNps as unknown as NumRow[]) ?? []).map((r) => r.value_numeric)
  const prev = ((prevNps as unknown as NumRow[]) ?? []).map((r) => r.value_numeric)

  if (recent.length < 5 && prev.length < 5) return null // Not enough data

  const factors: PredictionResult['factors'] = []
  let riskScore = 30 // baseline

  // Factor 1: NPS trend
  const recentAvg = recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 5
  const prevAvg = prev.length > 0 ? prev.reduce((s, v) => s + v, 0) / prev.length : 5
  const npsDelta = recentAvg - prevAvg

  if (npsDelta < -1) {
    const impact = Math.min(30, Math.abs(npsDelta) * 10)
    riskScore += impact
    factors.push({
      name: 'NPS declining',
      impact,
      description: `NPS dropped by ${Math.abs(npsDelta).toFixed(1)} points vs prior period`,
    })
  } else if (npsDelta > 1) {
    const impact = Math.min(20, npsDelta * 5)
    riskScore -= impact
    factors.push({
      name: 'NPS improving',
      impact: -impact,
      description: `NPS improved by ${npsDelta.toFixed(1)} points vs prior period`,
    })
  }

  // Factor 2: Response volume change
  const recentCount = recentResponses ?? 0
  const prevCount = prevResponses ?? 0
  if (prevCount > 0) {
    const volumeChange = ((recentCount - prevCount) / prevCount) * 100
    if (volumeChange < -30) {
      riskScore += 20
      factors.push({
        name: 'Response volume drop',
        impact: 20,
        description: `${Math.abs(volumeChange).toFixed(0)}% fewer responses than prior period`,
      })
    }
  }

  // Factor 3: High detractor ratio
  const detractors = recent.filter((v) => v <= 6).length
  const detractorRatio = recent.length > 0 ? detractors / recent.length : 0
  if (detractorRatio > 0.4) {
    const impact = Math.min(25, detractorRatio * 50)
    riskScore += impact
    factors.push({
      name: 'High detractor rate',
      impact,
      description: `${(detractorRatio * 100).toFixed(0)}% of respondents are detractors`,
    })
  }

  const confidence = Math.min(0.95, 0.3 + (recent.length + prev.length) / 200)

  return {
    prediction_type: 'churn_risk',
    score: Math.max(0, Math.min(100, Math.round(riskScore))),
    confidence: Math.round(confidence * 100) / 100,
    factors,
  }
}

// ── Satisfaction trend ──────────────────────────────────────────────────────

async function computeSatisfactionTrend(
  supabase: SupabaseClient,
  orgId: string
): Promise<Omit<PredictionResult, 'period_start' | 'period_end'> | null> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()

  const { data: csatData } = await supabase
    .from('response_answers')
    .select('value_numeric, created_at')
    .eq('question_type', 'csat')
    .gte('created_at', ninetyDaysAgo)
    .not('value_numeric', 'is', null)
    .order('created_at')

  type Row = { value_numeric: number; created_at: string }
  const rows = (csatData as unknown as Row[]) ?? []
  if (rows.length < 10) return null

  // Linear regression on CSAT scores over time
  const xValues = rows.map((_, i) => i)
  const yValues = rows.map((r) => r.value_numeric)
  const n = rows.length
  const xMean = xValues.reduce((s, v) => s + v, 0) / n
  const yMean = yValues.reduce((s, v) => s + v, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (xValues[i]! - xMean) * (yValues[i]! - yMean)
    denominator += (xValues[i]! - xMean) ** 2
  }

  const slope = denominator !== 0 ? numerator / denominator : 0
  const factors: PredictionResult['factors'] = []

  // Project 30 days forward
  const projectedChange = slope * 30
  let trendScore = 50 // neutral baseline

  if (projectedChange > 0.1) {
    trendScore = Math.min(90, 50 + projectedChange * 20)
    factors.push({
      name: 'Upward CSAT trend',
      impact: Math.round(projectedChange * 20),
      description: `CSAT trending up ~${projectedChange.toFixed(2)} points over next 30 days`,
    })
  } else if (projectedChange < -0.1) {
    trendScore = Math.max(10, 50 + projectedChange * 20)
    factors.push({
      name: 'Downward CSAT trend',
      impact: Math.round(projectedChange * 20),
      description: `CSAT trending down ~${Math.abs(projectedChange).toFixed(2)} points over next 30 days`,
    })
  }

  // R-squared for confidence
  const yPred = xValues.map((x) => yMean + slope * (x - xMean))
  const ssRes = yValues.reduce((s, y, i) => s + (y - yPred[i]!) ** 2, 0)
  const ssTot = yValues.reduce((s, y) => s + (y - yMean) ** 2, 0)
  const rSquared = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0

  return {
    prediction_type: 'satisfaction_trend',
    score: Math.round(trendScore),
    confidence: Math.round(Math.min(0.95, rSquared + 0.2) * 100) / 100,
    factors,
  }
}

// ── Volume forecast ─────────────────────────────────────────────────────────

async function computeVolumeForecast(
  supabase: SupabaseClient,
  orgId: string
): Promise<Omit<PredictionResult, 'period_start' | 'period_end'> | null> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()

  const { data } = await supabase
    .from('responses')
    .select('created_at')
    .eq('organization_id', orgId)
    .eq('is_complete', true)
    .gte('created_at', sixtyDaysAgo)

  if (!data || data.length < 14) return null

  // Group by week
  type Row = { created_at: string }
  const rows = data as unknown as Row[]
  const weekCounts = new Map<number, number>()

  for (const r of rows) {
    const weekNum = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (7 * 86400000))
    weekCounts.set(weekNum, (weekCounts.get(weekNum) ?? 0) + 1)
  }

  const weeks = Array.from(weekCounts.entries()).sort((a, b) => b[0] - a[0])
  if (weeks.length < 2) return null

  const recentWeekAvg = weeks.slice(0, 2).reduce((s, [, c]) => s + c, 0) / 2
  const olderWeekAvg = weeks.slice(2).reduce((s, [, c]) => s + c, 0) / Math.max(1, weeks.length - 2)

  const growthRate = olderWeekAvg > 0 ? ((recentWeekAvg - olderWeekAvg) / olderWeekAvg) * 100 : 0
  const forecastedMonthly = Math.round(recentWeekAvg * 4.3 * (1 + growthRate / 100))

  const factors: PredictionResult['factors'] = []
  factors.push({
    name: 'Weekly growth rate',
    impact: Math.round(growthRate),
    description: `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}% week-over-week change`,
  })
  factors.push({
    name: 'Forecasted monthly volume',
    impact: forecastedMonthly,
    description: `~${forecastedMonthly.toLocaleString()} responses expected next 30 days`,
  })

  // Score: 50 = flat, >50 = growing, <50 = declining
  const score = Math.max(0, Math.min(100, 50 + growthRate))

  return {
    prediction_type: 'response_volume_forecast',
    score: Math.round(score),
    confidence: Math.round(Math.min(0.9, 0.4 + rows.length / 500) * 100) / 100,
    factors,
  }
}
