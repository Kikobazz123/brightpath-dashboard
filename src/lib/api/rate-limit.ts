/**
 * A limiter for the endpoints that have to stay open.
 *
 * `POST /api/v1/leads` and the webhook routes cannot require a token — a
 * website visitor does not have one — and each of them runs the full AI
 * pipeline inline. That combination is worth guarding: without a limit, an
 * unauthenticated caller in a loop burns the day's model quota, and the
 * failure mode is that real leads stop being analysed.
 *
 * Be clear about what this is. State lives in the process, so on a serverless
 * host each instance keeps its own counter and a cold start forgets
 * everything. It stops an accident and a lazy script; it does not stop a
 * determined attacker, and it is not a substitute for a shared store. A real
 * deployment puts the counter in Redis or Vercel KV, at which point this file
 * is the only thing that changes.
 *
 * It is here rather than absent because "we will add rate limiting later" on
 * an open endpoint that spends money is how the later never comes.
 */

interface Window {
  count: number
  /** Epoch ms when this window resets. */
  resetAt: number
}

const WINDOWS = new Map<string, Window>()

/** Bound the map so a spray of unique IPs cannot grow it without limit. */
const MAX_TRACKED_KEYS = 10_000

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets — what a Retry-After header wants. */
  retryAfterSeconds: number
}

export interface RateLimitOptions {
  /** Requests permitted per window. */
  limit: number
  windowMs: number
}

/**
 * The caller's identity, best effort.
 *
 * Behind a proxy the socket address is the proxy, so the forwarded headers are
 * the only signal available. They are client-controlled and therefore spoofable
 * — which is another reason this is a speed bump rather than a security
 * control, and why it is documented as one.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now()
  const existing = WINDOWS.get(key)

  if (!existing || existing.resetAt <= now) {
    if (WINDOWS.size >= MAX_TRACKED_KEYS) evictExpired(now)

    WINDOWS.set(key, { count: 1, resetAt: now + windowMs })
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  existing.count += 1
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000),
  )

  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds,
  }
}

/**
 * Drop windows that have already elapsed.
 *
 * If that frees nothing — every window still live — the whole map is cleared
 * rather than growing past the cap. Losing counters means some requests get a
 * fresh allowance, which is the right way to fail: a limiter that runs the
 * process out of memory has caused a worse outage than the one it prevented.
 */
function evictExpired(now: number) {
  for (const [key, window] of WINDOWS) {
    if (window.resetAt <= now) WINDOWS.delete(key)
  }
  if (WINDOWS.size >= MAX_TRACKED_KEYS) WINDOWS.clear()
}

/** Capture is expensive — it runs the pipeline — so the allowance is small. */
export const CAPTURE_LIMIT: RateLimitOptions = {
  limit: Number(process.env.CAPTURE_RATE_LIMIT ?? 20),
  windowMs: 60_000,
}

/** Webhooks are machine traffic and legitimately burstier. */
export const WEBHOOK_LIMIT: RateLimitOptions = {
  limit: Number(process.env.WEBHOOK_RATE_LIMIT ?? 60),
  windowMs: 60_000,
}

/** Exposed for tests; resets the shared state between cases. */
export function _resetRateLimits() {
  WINDOWS.clear()
}
