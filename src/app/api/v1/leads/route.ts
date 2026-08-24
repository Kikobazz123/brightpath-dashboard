import {
  createLeadSchema,
  listLeadsQuerySchema,
} from "@/lib/contracts/leads"
import {
  fail,
  handleError,
  isResponse,
  ok,
  parseBody,
  parseQuery,
  requireAuth,
} from "@/lib/api/http"
import { createLead, listLeads, runFullPipeline } from "@/lib/leads/service"

/**
 * Lead capture.
 *
 * Deliberately unauthenticated: this is the endpoint a public website form
 * posts to, and a visitor has no token. It can only ever create — it cannot
 * read, list, or modify anything — so the open door leads into an empty room.
 *
 * By default the full pipeline runs inline before responding. That costs a few
 * seconds but it is the entire point of the product: the lead is analysed,
 * scored, and has a drafted reply before the visitor has closed the tab.
 * Pass ?analyze=0 to capture only.
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, createLeadSchema)
    if ("response" in parsed) return parsed.response

    const tenantId = process.env.DEMO_TENANT_ID?.trim() || "brightpath"
    const lead = await createLead(tenantId, parsed.data, "capture-form")

    const analyze =
      new URL(request.url).searchParams.get("analyze") !== "0"

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

export async function GET(request: Request) {
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

export const dynamic = "force-dynamic"
void fail
