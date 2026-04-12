'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

interface SignageMetrics {
  totalResponses: number
  npsScore: number | null
  csatAverage: number | null
  promoters: number
  passives: number
  detractors: number
}

interface SignageConfig {
  metric: string
  refreshInterval: number
  showTrend: boolean
  theme: string
}

interface SignageDisplayProps {
  surveyTitle: string
  orgId: string
  surveyId: string
  initialMetrics: SignageMetrics
  config: SignageConfig
}

export function SignageDisplay({
  surveyTitle,
  orgId,
  surveyId,
  initialMetrics,
  config,
}: SignageDisplayProps) {
  const [metrics, setMetrics] = useState<SignageMetrics>(initialMetrics)
  const [liveCount, setLiveCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Realtime subscription for instant updates
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`signage-${surveyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          setLiveCount((n) => n + 1)
          setMetrics((prev) => ({
            ...prev,
            totalResponses: prev.totalResponses + 1,
          }))
          setLastUpdated(new Date())
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, surveyId])

  // Periodic full refresh for accurate metric recalculation
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload()
    }, config.refreshInterval * 60 * 1000)

    return () => clearInterval(interval)
  }, [config.refreshInterval])

  const npsColor = metrics.npsScore !== null
    ? metrics.npsScore >= 50 ? 'text-emerald-400' : metrics.npsScore >= 0 ? 'text-amber-400' : 'text-red-400'
    : 'text-zinc-500'

  const csatColor = metrics.csatAverage !== null
    ? metrics.csatAverage >= 4 ? 'text-emerald-400' : metrics.csatAverage >= 3 ? 'text-amber-400' : 'text-red-400'
    : 'text-zinc-500'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-12 p-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-medium tracking-wide text-zinc-400 uppercase">
          {surveyTitle}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">Live Feedback Dashboard</p>
      </div>

      {/* Main metric */}
      <div className="text-center">
        {config.metric === 'nps' || config.metric === 'both' ? (
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
              Net Promoter Score
            </p>
            <p className={`mt-2 text-[10rem] font-bold leading-none tabular-nums ${npsColor}`}>
              {metrics.npsScore !== null ? metrics.npsScore : '—'}
            </p>
            {/* NPS breakdown bar */}
            {metrics.npsScore !== null && (
              <div className="mx-auto mt-8 flex max-w-md gap-1 overflow-hidden rounded-full">
                {metrics.detractors > 0 && (
                  <div
                    className="h-3 bg-red-500 transition-all duration-1000"
                    style={{
                      width: `${(metrics.detractors / (metrics.promoters + metrics.passives + metrics.detractors)) * 100}%`,
                    }}
                  />
                )}
                {metrics.passives > 0 && (
                  <div
                    className="h-3 bg-amber-400 transition-all duration-1000"
                    style={{
                      width: `${(metrics.passives / (metrics.promoters + metrics.passives + metrics.detractors)) * 100}%`,
                    }}
                  />
                )}
                {metrics.promoters > 0 && (
                  <div
                    className="h-3 bg-emerald-500 transition-all duration-1000"
                    style={{
                      width: `${(metrics.promoters / (metrics.promoters + metrics.passives + metrics.detractors)) * 100}%`,
                    }}
                  />
                )}
              </div>
            )}
            <div className="mt-4 flex justify-center gap-8 text-sm">
              <span className="text-red-400">{metrics.detractors} detractors</span>
              <span className="text-amber-400">{metrics.passives} passives</span>
              <span className="text-emerald-400">{metrics.promoters} promoters</span>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
              Customer Satisfaction
            </p>
            <p className={`mt-2 text-[10rem] font-bold leading-none tabular-nums ${csatColor}`}>
              {metrics.csatAverage !== null ? metrics.csatAverage.toFixed(1) : '—'}
            </p>
            <p className="mt-4 text-lg text-zinc-500">out of 5.0</p>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-12 text-zinc-500">
        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums text-zinc-300">
            {metrics.totalResponses.toLocaleString()}
          </p>
          <p className="text-xs uppercase tracking-wide">Responses (30d)</p>
        </div>

        {liveCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-emerald-400">
              +{liveCount} new
            </span>
          </div>
        )}

        <div className="text-center text-xs text-zinc-600">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {/* Branding */}
      <p className="absolute bottom-6 text-xs text-zinc-700">
        Powered by Pulse
      </p>
    </div>
  )
}
