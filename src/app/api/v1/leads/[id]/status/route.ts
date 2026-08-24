import { updateStatusSchema } from "@/lib/contracts/leads"
import {
  handleError,
  isResponse,
  ok,
  parseBody,
  requireAuth,
} from "@/lib/api/http"
import { updateStatus } from "@/lib/leads/service"
import { observe } from "@/lib/api/observability"

/**
 * Move a lead's status.
 *
 * Human-only. No AI stage writes here — the system prepares and recommends, a
 * person decides. This is also a first-touch action, so it stops the SLA clock.
 */
async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params

    const parsed = await parseBody(request, updateStatusSchema)
    if ("response" in parsed) return parsed.response

    return ok(
      await updateStatus(
        auth.tenantId,
        id,
        parsed.data.status,
        parsed.data.note,
        auth.actor,
      ),
    )
  } catch (error) {
    return handleError(error)
  }
}

export const PATCH = observe("PATCH /api/v1/leads/[id]/status", handlePATCH)

export const dynamic = "force-dynamic"
