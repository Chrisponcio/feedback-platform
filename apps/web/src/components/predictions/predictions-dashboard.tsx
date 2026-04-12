'use client'

interface PredictionFactor {
  name: string
  impact: number
  description: string
}

interface Prediction {
  id: string
  prediction_type: string
  score: number
  confidence: number
  factors: PredictionFactor[]
  period_start: string
  period_end: string
  created_at: string
}

interface HistoryRow {
  prediction_type: string
  score: number
  created_at: string
}

interface Props {
  predictions: Prediction[]
  history: HistoryRow[]
}

const TYPE_CONFIG: Record<string, { label: string; description: string; scoreLabel: (s: number) => string; color: (s: number) => string }> = {
  churn_risk: {
    label: 'Churn Risk',
    description: 'Likelihood of customer disengagement based on NPS trends and response patterns',
    scoreLabel: (s) => s >= 70 ? 'High Risk' : s >= 40 ? 'Moderate' : 'Low Risk',
    color: (s) => s >= 70 ? 'text-red-500' : s >= 40 ? 'text-amber-500' : 'text-emerald-500',
  },
  satisfaction_trend: {
    label: 'Satisfaction Trend',
    description: '30-day satisfaction forecast based on CSAT regression analysis',
    scoreLabel: (s) => s >= 60 ? 'Improving' : s >= 40 ? 'Stable' : 'Declining',
    color: (s) => s >= 60 ? 'text-emerald-500' : s >= 40 ? 'text-amber-500' : 'text-red-500',
  },
  response_volume_forecast: {
    label: 'Volume Forecast',
    description: 'Expected response volume trend based on recent collection patterns',
    scoreLabel: (s) => s >= 60 ? 'Growing' : s >= 40 ? 'Stable' : 'Declining',
    color: (s) => s >= 60 ? 'text-emerald-500' : s >= 40 ? 'text-amber-500' : 'text-red-500',
  },
}

export function PredictionsDashboard({ predictions, history }: Props) {
  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-8 py-16 text-center">
        <p className="text-lg font-medium">No predictions available yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Predictions are generated daily based on your survey response data.
          Collect at least 2 weeks of responses to start seeing forecasts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Prediction cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {predictions.map((pred) => {
          const config = TYPE_CONFIG[pred.prediction_type]
          if (!config) return null

          return (
            <div key={pred.id} className="rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{config.label}</p>
                  <p className={`mt-1 text-4xl font-bold tabular-nums ${config.color(pred.score)}`}>
                    {pred.score}
                  </p>
                  <p className={`mt-1 text-sm font-medium ${config.color(pred.score)}`}>
                    {config.scoreLabel(pred.score)}
                  </p>
                </div>
                <ConfidenceBadge value={pred.confidence} />
              </div>

              <p className="mt-3 text-xs text-muted-foreground">{config.description}</p>

              {/* Factors */}
              {pred.factors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contributing Factors
                  </p>
                  {pred.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`mt-0.5 text-xs font-bold ${f.impact >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {f.impact >= 0 ? '+' : ''}{f.impact}
                      </span>
                      <div>
                        <p className="text-xs font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-[10px] text-muted-foreground">
                Period: {pred.period_start} to {pred.period_end}
              </p>
            </div>
          )
        })}
      </div>

      {/* Score history */}
      {history.length > 3 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold">Prediction History (30 days)</h3>
          <div className="mt-4 space-y-4">
            {Object.entries(TYPE_CONFIG).map(([type, config]) => {
              const typeHistory = history
                .filter((h) => h.prediction_type === type)
                .slice(-14)
              if (typeHistory.length < 2) return null

              return (
                <div key={type}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{config.label}</p>
                  <div className="flex items-end gap-1 h-12">
                    {typeHistory.map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all"
                        style={{
                          height: `${Math.max(4, h.score)}%`,
                          backgroundColor: h.score >= 60
                            ? 'rgb(16 185 129 / 0.6)'
                            : h.score >= 40
                              ? 'rgb(245 158 11 / 0.6)'
                              : 'rgb(239 68 68 / 0.6)',
                        }}
                        title={`${h.score} — ${new Date(h.created_at).toLocaleDateString()}`}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {pct}% conf.
    </span>
  )
}
