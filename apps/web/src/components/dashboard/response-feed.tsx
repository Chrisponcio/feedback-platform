'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

interface FeedResponse {
  id: string
  created_at: string
  channel: string
  is_complete: boolean
  surveys: { title: string } | null
}

interface ResponseFeedProps {
  initialResponses: FeedResponse[]
  orgId: string
}

const CHANNEL_LABEL: Record<string, string> = {
  web_link:  'Web',
  kiosk:     'Kiosk',
  email:     'Email',
  sms:       'SMS',
  qr_code:   'QR',
  web_embed: 'Embed',
  api:       'API',
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function ResponseFeed({ initialResponses, orgId }: ResponseFeedProps) {
  const [responses, setResponses] = useState<FeedResponse[]>(initialResponses)
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`org-responses-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const newRow = payload.new as FeedResponse
          setResponses((prev) => [newRow, ...prev].slice(0, 20))
          setLiveCount((n) => n + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId])

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="text-sm font-semibold">Recent responses</h3>
        {liveCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {liveCount} live
          </span>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">
          No responses yet. Share your survey to start collecting feedback.
        </div>
      ) : (
        <ul className="divide-y">
          {responses.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {r.surveys?.title ?? 'Unknown survey'}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {CHANNEL_LABEL[r.channel] ?? r.channel}
                </span>
                {r.is_complete && (
                  <span className="text-xs text-emerald-600">✓</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
