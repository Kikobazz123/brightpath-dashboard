import { importLeadsSchema } from "@/lib/contracts/leads"
import {
  handleError,
  isResponse,
  ok,
  parseBody,
  requireAuth,
} from "@/lib/api/http"
import { createLead, runFullPipeline } from "@/lib/leads/service"

/**
 * Bulk import from a spreadsheet or CRM export.
 *
 * Each lead is imported independently: one malformed row fails alone and is
 * reported, rather than rolling back a 200-row upload. The response lists what
 * succeeded and what did not, because "some of it worked" is the truth and the
 * operator needs to know which half.
 */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth

    const parsed = await parseBody(request, importLeadsSchema)
    if ("response" in parsed) return parsed.response

    const created: string[] = []
    const failures: Array<{ index: number; reason: string }> = []

    for (const [index, input] of parsed.data.leads.entries()) {
      try {
        const lead = await createLead(auth.tenantId, input, auth.actor)
        created.push(lead.id)
        if (parsed.data.auto_analyze) {
          await runFullPipeline(auth.tenantId, lead.id)
        }
      } catch (error) {
        failures.push({
          index,
          reason: error instanceof Error ? error.message : "unknown error",
        })
      }
    }

    return ok(
      {
        imported: created.length,
        failed: failures.length,
        lead_ids: created,
        failures,
      },
      created.length > 0 ? 201 : 400,
    )
  } catch (error) {
    return handleError(error)
  }
}
