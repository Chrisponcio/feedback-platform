/**
 * AI sentiment analysis for open-text survey answers.
 *
 * Pipeline:
 * 1. Classify with gpt-4o-mini: sentiment + topics + 1-sentence summary
 * 2. Embed with text-embedding-3-small: 1536-dim vector for semantic search
 * 3. Upsert into response_tags
 *
 * Called async from /api/submit and the /api/cron/process-ai-jobs cron.
 */

import OpenAI from 'openai'
import { createServiceRoleClient } from './supabase/server'

const MAX_TEXT_LENGTH = 2000  // chars — truncate before sending to API

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openaiClient
}

export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface SentimentResult {
  sentiment:       Sentiment
  sentiment_score: number   // -1.0 to 1.0
  topics:          string[]
  summary:         string
}

/**
 * Classify text with gpt-4o-mini.
 * Returns null if OPENAI_API_KEY is not configured.
 */
export async function classifySentiment(text: string): Promise<SentimentResult | null> {
  const ai = getOpenAI()
  if (!ai) return null

  const truncated = text.slice(0, MAX_TEXT_LENGTH)

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a feedback analyst. Analyze the survey response and return JSON with exactly these fields:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentiment_score": number between -1.0 (most negative) and 1.0 (most positive),
  "topics": array of 1-4 short topic strings (e.g. ["pricing", "customer support"]),
  "summary": "One sentence summary of the feedback."
}`,
      },
      { role: 'user', content: truncated },
    ],
  })

  const raw = response.choices[0]?.message.content
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as {
      sentiment?: string
      sentiment_score?: number
      topics?: string[]
      summary?: string
    }

    const sentiment = (['positive', 'neutral', 'negative'].includes(parsed.sentiment ?? ''))
      ? parsed.sentiment as Sentiment
      : 'neutral'

    return {
      sentiment,
      sentiment_score: Math.max(-1, Math.min(1, parsed.sentiment_score ?? 0)),
      topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 4) : [],
      summary: parsed.summary ?? '',
    }
  } catch {
    return null
  }
}

/**
 * Generate text-embedding-3-small vector (1536 dims).
 */
export async function embedText(text: string): Promise<number[] | null> {
  const ai = getOpenAI()
  if (!ai) return null

  const response = await ai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, MAX_TEXT_LENGTH),
  })

  return response.data[0]?.embedding ?? null
}

/**
 * Process a single open-text answer: classify + embed + upsert response_tag.
 * Returns true on success.
 */
export async function processOpenTextAnswer(job: {
  responseId:     string
  questionId:     string
  organizationId: string
  text:           string
}): Promise<boolean> {
  const [classification, embedding] = await Promise.all([
    classifySentiment(job.text),
    embedText(job.text),
  ])

  if (!classification) return false

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('response_tags')
    .upsert({
      organization_id: job.organizationId,
      response_id:     job.responseId,
      question_id:     job.questionId,
      sentiment:       classification.sentiment,
      sentiment_score: classification.sentiment_score,
      topics:          classification.topics,
      summary:         classification.summary,
      embedding:       embedding ? JSON.stringify(embedding) : null,
      model_version:   'gpt-4o-mini',
    } as never, {
      onConflict: 'response_id,question_id',
      ignoreDuplicates: false,
    })

  return !error
}

/**
 * Queue a job for async processing (used from /api/submit to avoid blocking).
 */
export async function enqueueAiJob(job: {
  responseId:     string
  questionId:     string
  organizationId: string
  text:           string
}): Promise<void> {
  const supabase = createServiceRoleClient()
  await supabase
    .from('pending_ai_jobs')
    .insert({
      organization_id: job.organizationId,
      response_id:     job.responseId,
      question_id:     job.questionId,
      text_value:      job.text,
    } as never)
}
