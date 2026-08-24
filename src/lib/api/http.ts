import { NextResponse } from "next/server"
import type { z } from "zod"

import type { ApiErrorCode } from "@/lib/contracts/leads"
import { NotFoundError } from "@/lib/leads/service"

/**
 * Shared HTTP plumbing: one response envelope, one auth check, one error map.
 *
 * Routes that each roll their own shape are how a frontend ends up with
 * defensive `if (data?.error?.message ?? data?.detail)` branches everywhere.
 */

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  provider_unavailable: 503,
  internal: 500,
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true as const, data }, { status })
}

export function fail(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string[]>,
) {
  return NextResponse.json(
    { ok: false as const, error: { code, message, ...(fields ? { fields } : {}) } },
    { status: STATUS[code] },
  )
}

export interface AuthContext {
  tenantId: string
  actor: string
}

/**
 * Resolve the caller.
 *
 * The template ships sign-in pages but no auth backend, so this is a shared
 * bearer token mapped to a single tenant — deliberately simple, and deliberately
 * still a real boundary: every query filters by the tenant this returns, so
 * swapping in proper sessions later changes this function and nothing else.
 *
 * Public lead capture is exempt (a website visitor has no token) and is handled
 * by the capture route itself, which can only ever create.
 */
export function authenticate(request: Request): AuthContext | null {
  const expected = process.env.DEMO_API_TOKEN?.trim()
  const tenantId = process.env.DEMO_TENANT_ID?.trim() || "brightpath"

  // With no token configured, the API is single-tenant and open locally.
  if (!expected) return { tenantId, actor: "local" }

  const header = request.headers.get("authorization") ?? ""
  const presented = header.replace(/^Bearer\s+/i, "").trim()
  if (!presented || presented !== expected) return null

  const actor = request.headers.get("x-actor")?.trim() || "rep"
  return { tenantId, actor }
}

export function requireAuth(request: Request): AuthContext | NextResponse {
  const auth = authenticate(request)
  return auth ?? fail("unauthorized", "A valid bearer token is required.")
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

/** Parse and validate a JSON body, returning a 400 with field detail on failure. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { response: fail("bad_request", "Request body must be valid JSON.") }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_"
      ;(fields[key] ??= []).push(issue.message)
    }
    return {
      response: fail("bad_request", "Validation failed.", fields),
    }
  }
  return { data: parsed.data }
}

export function parseQuery<S extends z.ZodType>(
  request: Request,
  schema: S,
): { data: z.infer<S> } | { response: NextResponse } {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      ;(fields[issue.path.join(".") || "_"] ??= []).push(issue.message)
    }
    return { response: fail("bad_request", "Invalid query parameters.", fields) }
  }
  return { data: parsed.data }
}

/**
 * Map thrown errors to responses.
 *
 * Internal messages are logged but not returned — a stack trace or a connection
 * string in an error body is a real leak, and lead data is not ours to spill.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return fail("not_found", "Lead not found.")
  }

  const message = error instanceof Error ? error.message : String(error)

  if (/DATABASE_URL/.test(message)) {
    return fail(
      "internal",
      "The database is not configured. Copy .env.example to .env.local and set DATABASE_URL.",
    )
  }
  if (/rate|429|quota/i.test(message)) {
    return fail("rate_limited", "The AI provider is rate limited. Try again shortly.")
  }

  console.error("[api]", message)
  return fail("internal", "Something went wrong handling this request.")
}
