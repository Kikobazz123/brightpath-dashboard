import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { runScoring } from "@/lib/leads/service"
import { observe } from "@/lib/api/observability"

/** Apply the BrightPath rubric to stored evidence. Deterministic: no model is involved, and the same evidence always yields the same score. Analyses first if no evidence exists yet. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok(await runScoring(auth.tenantId, id))
  } catch (error) {
    return handleError(error)
  }
}

export const POST = observe("POST /api/v1/leads/[id]/score", handlePOST)

export const dynamic = "force-dynamic"
