import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { getActivity } from "@/lib/leads/service"

/**
 * The lead's timeline: every action, who took it, and when.
 *
 * This is the audit trail and the evidence behind the SLA numbers. Append-only,
 * so it can be trusted as a record rather than a summary.
 */
export async function GET(
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
