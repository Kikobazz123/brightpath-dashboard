import { handleError, isResponse, ok, requireAuth } from "@/lib/api/http"
import { getStats } from "@/lib/leads/service"

/** Headline numbers for the dashboard, including the speed-to-lead figures. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    return ok(await getStats(auth.tenantId))
  } catch (error) {
    return handleError(error)
  }
}

export const dynamic = "force-dynamic"
