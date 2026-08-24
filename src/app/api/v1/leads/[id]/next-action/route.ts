import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { runNextAction } from "@/lib/leads/service"
import { observe } from "@/lib/api/observability"

/** Recommend one next step. Rule-based, so the same assessment always produces the same advice and the reasoning can be shown. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok(await runNextAction(auth.tenantId, id))
  } catch (error) {
    return handleError(error)
  }
}

export const POST = observe("POST /api/v1/leads/[id]/next-action", handlePOST)

export const dynamic = "force-dynamic"
