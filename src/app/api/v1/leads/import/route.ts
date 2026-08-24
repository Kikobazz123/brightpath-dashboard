import { importLeadsSchema } from "@/lib/contracts/leads"
import {
  handleError,
  isResponse,
  ok,
  parseBody,
  requireAuth,
} from "@/lib/api/http"
import { createLead, runFullPipeline } from "@/lib/leads/service"
import { observe } from "@/lib/api/observability"

/**
 * Bulk import from a spreadsheet or CRM export.
 *
 * Each lead is imported independently: one malformed row fails alone and is
 * reported, rather than rolling back a 200-row upload. The response lists what
 * succeeded and what did not, because "some of it worked" is the truth and the
 * operator needs to know which half.
 */
async function handlePOST(request: Request) {
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
        /**
         * Report the row, not the reason.
         *
         * A raw error message here can carry a constraint name, a column, or a
         * connection string straight back to the caller — the same leak
         * `handleError` exists to prevent, and it would be strange to guard it
         * on every other route and then hand it over in a bulk response. The
         * detail goes to the log, where an operator can reach it.
         */
        console.error(`[import] row ${index} failed`, error)
        failures.push({ index, reason: "This row could not be imported." })
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

export const POST = observe("POST /api/v1/leads/import", handlePOST)

export const dynamic = "force-dynamic"
