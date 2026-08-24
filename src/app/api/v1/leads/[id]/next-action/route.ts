import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { runNextAction } from "@/lib/leads/service"

/** Recommend one next step. Rule-based, so the same assessment always produces the same advice and the reasoning can be shown. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok(await runNextAction(auth.tenantId, id))
  } catch (error) {
    return handleError(error)
  }
}
