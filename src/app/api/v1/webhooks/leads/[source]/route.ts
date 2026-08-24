import { createLeadSchema, leadSourceSchema } from "@/lib/contracts/leads"
import { fail, handleError, ok, parseBody } from "@/lib/api/http"
import { createLead, runFullPipeline } from "@/lib/leads/service"

/**
 * Integration boundary for third-party lead sources.
 *
 * One route per source keeps provider-specific field mapping out of the core
 * pipeline. As real integrations arrive, each gets its own adapter here and the
 * rest of the system stays unaware of where a lead came from.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ source: string }> },
) {
  try {
    const { source } = await params
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
    } catch {
      return ok(lead, 201)
    }
  } catch (error) {
    return handleError(error)
  }
}
