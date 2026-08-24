import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { runScoring } from "@/lib/leads/service"

/** Apply the BrightPath rubric to stored evidence. Deterministic: no model is involved, and the same evidence always yields the same score. Analyses first if no evidence exists yet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok(await runScoring(auth.tenantId, id))
  } catch (error) {
    return handleError(error)
  }
}
