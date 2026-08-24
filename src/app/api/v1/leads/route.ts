import {
  createLeadSchema,
  listLeadsQuerySchema,
} from "@/lib/contracts/leads"
import {
  failRateLimited,
  handleError,
  isResponse,
  ok,
  parseBody,
  parseQuery,
  requireAuth,
} from "@/lib/api/http"
import { observe } from "@/lib/api/observability"
import { CAPTURE_LIMIT, clientKey, rateLimit } from "@/lib/api/rate-limit"
import { createLead, listLeads, runFullPipeline } from "@/lib/leads/service"

/**
 * Lead capture.
 *
 * Deliberately unauthenticated: this is the endpoint a public website form
 * posts to, and a visitor has no token. It can only ever create — it cannot
 * read, list, or modify anything — so the open door leads into an empty room.
 *
 * It is rate limited, though, because the room is not free to enter: each call
 * runs the full pipeline inline, so an unauthenticated loop here spends the
 * day's model quota and stops real leads being analysed.
 *
 * By default the full pipeline runs before responding. That costs a few seconds
 * but it is the entire point of the product: the lead is analysed, scored, and
 * has a drafted reply before the visitor has closed the tab. Pass ?analyze=0 to
 * capture only.
 */
async function capture(request: Request) {
  try {
    const limit = rateLimit(`capture:${clientKey(request)}`, CAPTURE_LIMIT)
    if (!limit.allowed) return failRateLimited(limit.retryAfterSeconds)

    const parsed = await parseBody(request, createLeadSchema)
    if ("response" in parsed) return parsed.response

    const tenantId = process.env.DEMO_TENANT_ID?.trim() || "brightpath"
    const lead = await createLead(tenantId, parsed.data, "capture-form")

    const analyze = new URL(request.url).searchParams.get("analyze") !== "0"
    if (!analyze) return ok(lead, 201)

    try {
      return ok(await runFullPipeline(tenantId, lead.id), 201)
    } catch (error) {
      /**
       * The lead is already saved. A provider outage must never lose it —
       * losing leads is the failure this system exists to prevent — so the
       * capture still succeeds and the lead sits unanalysed for a retry.
       */
      console.error("[capture] pipeline failed, lead retained", error)
      return ok(lead, 201)
    }
  } catch (error) {
    return handleError(error)
  }
}

async function list(request: Request) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth

    const query = parseQuery(request, listLeadsQuerySchema)
    if ("response" in query) return query.response

    const { leads, total } = await listLeads(auth.tenantId, query.data)
    return ok({
      leads,
      pagination: {
        page: query.data.page,
        page_size: query.data.page_size,
        total,
        total_pages: Math.max(1, Math.ceil(total / query.data.page_size)),
      },
    })
  } catch (error) {
    return handleError(error)
  }
}

export const POST = observe("POST /api/v1/leads", capture)
export const GET = observe("GET /api/v1/leads", list)

export const dynamic = "force-dynamic"
