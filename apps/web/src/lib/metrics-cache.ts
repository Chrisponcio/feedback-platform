/**
 * In-memory metrics cache with TTL.
 *
 * Provides a simple cache layer for dashboard metrics to reduce database load
 * at high response volumes. Falls back gracefully when Vercel KV is not configured.
 *
 * When @vercel/kv is available (Pro plan), swap the in-memory Map for KV.
 * The interface stays the same — get/set with TTL.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 30_000 // 30 seconds

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/**
 * Cache-through helper: returns cached value if available,
 * otherwise calls the fetch function and caches the result.
 */
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCached<T>(key)
  if (cached !== null) return cached

  const value = await fetchFn()
  setCached(key, value, ttlMs)
  return value
}
