import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { runAnalysis } from "@/lib/leads/service"

/** Extract evidence from the lead's own words. Does not score — scoring is a separate step so evidence can be inspected before a number is attached to it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok(await runAnalysis(auth.tenantId, id))
  } catch (error) {
    return handleError(error)
  }
}
