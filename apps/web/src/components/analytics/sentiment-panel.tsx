'use client'

type Sentiment = 'positive' | 'neutral' | 'negative'

export interface SentimentSummary {
  positive: number
  neutral:  number
  negative: number
  total:    number
  topTopics: { topic: string; count: number }[]
  recentTags: {
    id: string
    sentiment: Sentiment
    summary: string | null
    topics: string[]
    created_at: string
  }[]
}

interface SentimentPanelProps {
  data: SentimentSummary
}

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: 'bg-emerald-500',
  neutral:  'bg-amber-400',
  negative: 'bg-red-500',
}

const SENTIMENT_TEXT: Record<Sentiment, string> = {
  positive: 'text-emerald-700',
  neutral:  'text-amber-700',
  negative: 'text-red-700',
}

const SENTIMENT_BG: Record<Sentiment, string> = {
  positive: 'bg-emerald-50',
  neutral:  'bg-amber-50',
  negative: 'bg-red-50',
}

export function SentimentPanel({ data }: SentimentPanelProps) {
  if (data.total === 0) {
    return (
      <div className="rounded-lg border bg-background p-4">
        <h3 className="text-sm font-semibold mb-2">AI Sentiment</h3>
        <p className="text-sm text-muted-foreground">
          No open-text responses analysed yet. Sentiment analysis runs automatically when
          respondents submit free-text answers.
        </p>
      </div>
    )
  }

  const pct = (n: number) => data.total > 0 ? Math.round((n / data.total) * 100) : 0

  return (
    <div className="rounded-lg border bg-background p-4 space-y-4">
      <h3 className="text-sm font-semibold">AI Sentiment (last 30d)</h3>

      {/* Bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {(['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => (
          data[s] > 0 && (
            <div
              key={s}
              className={`${SENTIMENT_COLORS[s]} transition-all`}
              style={{ width: `${pct(data[s])}%` }}
              title={`${s}: ${data[s]} (${pct(data[s])}%)`}
            />
          )
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {(['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${SENTIMENT_COLORS[s]}`} />
            <span className="capitalize">{s}</span>
            <span className="text-muted-foreground">{pct(data[s])}%</span>
          </div>
        ))}
      </div>

      {/* Top topics */}
      {data.topTopics.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Top topics</p>
          <div className="flex flex-wrap gap-1.5">
            {data.topTopics.map(({ topic, count }) => (
              <span
                key={topic}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
              >
                {topic} <span className="text-muted-foreground">·{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent tags */}
      {data.recentTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Recent AI summaries</p>
          {data.recentTags.slice(0, 5).map((tag) => (
            <div key={tag.id} className={`rounded-md p-2.5 ${SENTIMENT_BG[tag.sentiment]}`}>
              <div className="flex items-start gap-2">
                <span className={`text-xs font-semibold capitalize shrink-0 ${SENTIMENT_TEXT[tag.sentiment]}`}>
                  {tag.sentiment}
                </span>
                <p className="text-xs text-foreground leading-relaxed">
                  {tag.summary ?? '—'}
                </p>
              </div>
              {tag.topics.length > 0 && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  {tag.topics.map((t) => (
                    <span key={t} className="text-xs text-muted-foreground">#{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
