/**
 * Operational visibility for the API.
 *
 * Three things are worth knowing when something goes wrong at 9am on a Monday:
 * which request it was, how long it took, and whether the model or the database
 * was the slow part. That is the whole ambition here — no vendor agent, no
 * sampling, just one structured line per request on stdout, which is what every
 * host this could run on already collects.
 *
 * What is deliberately never logged: lead text, contact details, drafted
 * messages, bearer tokens, connection strings. A log line is the easiest place
 * in a system to leak a customer's data into a third party's retention policy,
 * and none of that is needed to debug a route. Identifiers and counts are.
 */

export interface RequestLog {
  event: "api_request"
  request_id: string
  method: string
  route: string
  status: number
  duration_ms: number
  tenant?: string
  actor?: string
  /** Present only on failures — the envelope's error code, never a stack. */
  error_code?: string
}

/**
 * Correlation id.
 *
 * Reuses the platform's own header when there is one — Vercel sets
 * `x-vercel-id` — so a line here can be lined up with the host's request log
 * rather than living in a parallel universe with its own ids.
 */
export function requestId(request: Request): string {
  const upstream =
    request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id")
  if (upstream) return upstream.slice(0, 128)
  return crypto.randomUUID()
}

/** One line, one JSON object. Grep-able by hand, parseable by anything. */
function emit(entry: object) {
  console.log(JSON.stringify(entry))
}

export function logRequest(entry: RequestLog) {
  emit(entry)
}

/**
 * Record a slow or failed dependency call.
 *
 * `ok` is separate from a thrown error because the interesting case is the call
 * that succeeded but took nine seconds — that is the one that quietly makes the
 * capture form feel broken, and it never appears in an error log.
 */
export function logDependency(entry: {
  dependency: "ai" | "database"
  operation: string
  duration_ms: number
  ok: boolean
  request_id?: string
  detail?: Record<string, unknown>
}) {
  emit({ event: "dependency", ...entry })
}

/**
 * Wrap a route handler so every response is timed and logged.
 *
 * Applied per route rather than in middleware because middleware runs before
 * the handler and cannot see the status or the duration of the work it wraps —
 * it would log that a request arrived, which is the half nobody needs.
 */
export function observe<Args extends unknown[]>(
  route: string,
  handler: (request: Request, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request, ...args) => {
    const started = Date.now()
    const id = requestId(request)

    try {
      const response = await handler(request, ...args)

      logRequest({
        event: "api_request",
        request_id: id,
        method: request.method,
        route,
        status: response.status,
        duration_ms: Date.now() - started,
        ...(response.status >= 400
          ? { error_code: await peekErrorCode(response) }
          : {}),
      })

      // Hand the id back so a support conversation can start with one string.
      response.headers.set("x-request-id", id)
      return response
    } catch (error) {
      /**
       * The handler already maps thrown errors to responses, so reaching here
       * means the mapping itself failed. Log it and rethrow rather than
       * inventing a response — Next's own error handling is better placed to
       * decide what a truly unhandled error looks like.
       */
      logRequest({
        event: "api_request",
        request_id: id,
        method: request.method,
        route,
        status: 500,
        duration_ms: Date.now() - started,
        error_code: "unhandled",
      })
      console.error(`[api:${route}] unhandled`, error)
      throw error
    }
  }
}

/**
 * Read the error code out of a failure response without consuming it.
 *
 * A `Response` body is a one-shot stream, so this reads a clone. Only the code
 * is taken — the message can carry validation detail about lead fields, and
 * that does not belong in a log.
 */
async function peekErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as {
      error?: { code?: unknown }
    }
    return typeof body.error?.code === "string" ? body.error.code : undefined
  } catch {
    return undefined
  }
}
