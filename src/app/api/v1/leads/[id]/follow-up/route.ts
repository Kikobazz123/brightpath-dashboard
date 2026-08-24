import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { runFollowUp } from "@/lib/leads/service"

/** Draft a personalised follow-up from confirmed facts only. Sets state to 'drafted' — never 'sent'. Sending requires a confirmed provider receipt. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok(await runFollowUp(auth.tenantId, id))
  } catch (error) {
    return handleError(error)
  }
}
