import type { Metadata } from 'next'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PredictionsDashboard } from '@/components/predictions/predictions-dashboard'

export const metadata: Metadata = { title: 'Predictive Analytics' }

export default async function PredictionsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) redirect('/login')

  const service = createServiceRoleClient()

  // Get latest prediction for each type
  const { data: predictions } = await (service
    .from('org_predictions' as never)
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20) as unknown as Promise<{ data: unknown[] | null }>)

  // Deduplicate to latest per type
  type Prediction = {
    id: string
    prediction_type: string
    score: number
    confidence: number
    factors: { name: string; impact: number; description: string }[]
    period_start: string
    period_end: string
    created_at: string
  }

  const rows = (predictions as unknown as Prediction[]) ?? []
  const latestByType = new Map<string, Prediction>()
  for (const p of rows) {
    if (!latestByType.has(p.prediction_type)) {
      latestByType.set(p.prediction_type, p)
    }
  }

  // Get historical predictions for trend
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: history } = await (service
    .from('org_predictions' as never)
    .select('prediction_type, score, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at') as unknown as Promise<{ data: unknown[] | null }>)

  type HistoryRow = { prediction_type: string; score: number; created_at: string }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Predictive Analytics</h1>
        <p className="text-muted-foreground">
          AI-powered forecasts for churn risk, satisfaction trends, and response volume
        </p>
      </div>

      <PredictionsDashboard
        predictions={Array.from(latestByType.values())}
        history={(history as unknown as HistoryRow[]) ?? []}
      />
    </div>
  )
}
