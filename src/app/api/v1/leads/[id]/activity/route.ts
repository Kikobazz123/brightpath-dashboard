import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { getActivity } from "@/lib/leads/service"
import { observe } from "@/lib/api/observability"

/**
 * The lead's timeline: every action, who took it, and when.
 *
 * This is the audit trail and the evidence behind the SLA numbers. Append-only,
 * so it can be trusted as a record rather than a summary.
 */
async function handleGET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok({ activities: await getActivity(auth.tenantId, id) })
  } catch (error) {
    return handleError(error)
  }
}

export const GET = observe("GET /api/v1/leads/[id]/activity", handleGET)

export const dynamic = "force-dynamic"
