/**
 * In-process token-bucket rate limiter.
 *
 * Deliberately simple: a single Node instance is the common case for this app,
 * and the interface (`rateLimit(key, opts)`) is the same one a Redis-backed
 * implementation would expose, so swapping it later is a one-file change rather
 * than an audit of every call site.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // Opportunistic eviction keeps the map bounded without a timer.
    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [k, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(k);
      }
    }
    const bucket = { count: 1, resetAt: now + options.windowMs };
    buckets.set(key, bucket);
    return { ok: true, remaining: options.limit - 1, resetAt: bucket.resetAt };
  }

  existing.count += 1;
  return {
    ok: existing.count <= options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Test helper — never called in application code. */
export function __resetRateLimits() {
  buckets.clear();
}
