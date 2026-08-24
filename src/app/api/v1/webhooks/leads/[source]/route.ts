import { createLeadSchema, leadSourceSchema } from "@/lib/contracts/leads"
import {
  fail,
  failRateLimited,
  handleError,
  ok,
  parseBody,
} from "@/lib/api/http"
import { observe } from "@/lib/api/observability"
import { WEBHOOK_LIMIT, clientKey, rateLimit } from "@/lib/api/rate-limit"
import { createLead, runFullPipeline } from "@/lib/leads/service"

/**
 * Integration boundary for third-party lead sources.
 *
 * One route per source keeps provider-specific field mapping out of the core
 * pipeline. As real integrations arrive, each gets its own adapter here and the
 * rest of the system stays unaware of where a lead came from.
 *
 * Unauthenticated for the same reason as capture — a webhook sender has no
 * token of ours — and rate limited for the same reason too, with a higher
 * allowance because machine traffic is legitimately burstier than a person
 * filling in a form. A production integration would additionally verify the
 * sender's signature, which is per-provider work and belongs in each adapter.
 */
async function receive(
  request: Request,
  { params }: { params: Promise<{ source: string }> },
) {
  try {
    const { source } = await params

    const limit = rateLimit(
      `webhook:${source}:${clientKey(request)}`,
      WEBHOOK_LIMIT,
    )
    if (!limit.allowed) return failRateLimited(limit.retryAfterSeconds)

    const parsedSource = leadSourceSchema.safeParse(source)
    if (!parsedSource.success) {
      return fail("bad_request", `Unknown lead source "${source}".`)
    }

    const parsed = await parseBody(request, createLeadSchema)
    if ("response" in parsed) return parsed.response

    const tenantId = process.env.DEMO_TENANT_ID?.trim() || "brightpath"
    const lead = await createLead(
      tenantId,
      { ...parsed.data, source: parsedSource.data },
      `webhook:${source}`,
    )

    try {
      return ok(await runFullPipeline(tenantId, lead.id), 201)
    } catch (error) {
      // As with capture: the lead is saved, so a provider outage costs an
      // analysis, not the lead itself.
      console.error(`[webhook:${source}] pipeline failed, lead retained`, error)
      return ok(lead, 201)
    }
  } catch (error) {
    return handleError(error)
  }
}

export const POST = observe("POST /api/v1/webhooks/leads/[source]", receive)

export const dynamic = "force-dynamic"
