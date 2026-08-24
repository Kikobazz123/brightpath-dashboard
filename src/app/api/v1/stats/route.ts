import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { getStats } from "@/lib/leads/service"
import { observe } from "@/lib/api/observability"

/** Headline numbers for the dashboard, including the speed-to-lead figures. */
async function handleGET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    return ok(await getStats(auth.tenantId))
  } catch (error) {
    return handleError(error)
  }
}

export const GET = observe("GET /api/v1/stats", handleGET)

export const dynamic = "force-dynamic"
