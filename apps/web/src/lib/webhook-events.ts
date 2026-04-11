/**
 * Shared webhook event constants — safe to import in both client and server code.
 */
export const WEBHOOK_EVENTS = [
  'response.created',
  'response.updated',
  'survey.created',
  'survey.status_changed',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]
