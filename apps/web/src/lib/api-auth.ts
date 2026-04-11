/**
 * API key authentication for /api/v1/ routes.
 *
 * Keys are stored as bcrypt hashes in the api_keys table.
 * The raw key is only shown once at creation time.
 *
 * Format: pulse_live_<random64hex>  (prefix "pulse_live_" or "pulse_test_")
 */

import bcrypt from 'bcryptjs'
import { createServiceRoleClient } from './supabase/server'

export interface ApiKeyContext {
  organizationId: string
  keyId: string
  scopes: string[]
}

/**
 * Authenticate an incoming API key from the Authorization header.
 * Returns the key context or null if invalid/revoked/expired.
 */
export async function authenticateApiKey(
  authHeader: string | null
): Promise<ApiKeyContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey.startsWith('pulse_')) return null

  // Use the prefix (first 16 chars) to narrow down candidates
  const prefix = rawKey.slice(0, 16)

  const supabase = createServiceRoleClient()

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, organization_id, key_hash, scopes, expires_at, revoked_at')
    .eq('key_prefix', prefix)
    .is('revoked_at', null)

  if (!keys || keys.length === 0) return null

  type KeyRow = {
    id: string
    organization_id: string
    key_hash: string
    scopes: string[]
    expires_at: string | null
    revoked_at: string | null
  }

  for (const key of keys as unknown as KeyRow[]) {
    if (key.expires_at && new Date(key.expires_at) < new Date()) continue
    const match = await bcrypt.compare(rawKey, key.key_hash)
    if (match) {
      // Update last_used_at asynchronously — don't await
      void supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() } as never)
        .eq('id', key.id)

      return {
        organizationId: key.organization_id,
        keyId: key.id,
        scopes: key.scopes,
      }
    }
  }

  return null
}

/**
 * Generate a new API key. Returns { rawKey, prefix, hash }.
 * rawKey should be shown to the user exactly once and never stored.
 */
export async function generateApiKey(type: 'live' | 'test' = 'live') {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const rawKey = `pulse_${type}_${random}`
  const prefix = rawKey.slice(0, 16)
  const hash = await bcrypt.hash(rawKey, 10)
  return { rawKey, prefix, hash }
}
