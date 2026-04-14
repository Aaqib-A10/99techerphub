/**
 * Simple in-memory rate limiter for API routes.
 * Tracks attempts per key (e.g., IP address) within a sliding window.
 *
 * NOTE: This is per-process. In a multi-instance deployment, replace
 * with Redis-backed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  maxAttempts: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check if a request is within rate limits.
 * Returns whether the request is allowed, how many attempts remain,
 * and how long until the window resets.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // No existing entry or window has expired — allow and start fresh
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.maxAttempts - 1, retryAfterMs: 0 };
  }

  // Within window — check count
  if (entry.count < options.maxAttempts) {
    entry.count++;
    return {
      allowed: true,
      remaining: options.maxAttempts - entry.count,
      retryAfterMs: 0,
    };
  }

  // Over limit
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: entry.resetAt - now,
  };
}
