import { updateLeadSchema } from "@/lib/contracts/leads"
import {
  handleError,
  isResponse,
  ok,
  parseBody,
  requireAuth,
} from "@/lib/api/http"
import { getLead, updateLead } from "@/lib/leads/service"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params
    return ok(await getLead(auth.tenantId, id))
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params

    const parsed = await parseBody(request, updateLeadSchema)
    if ("response" in parsed) return parsed.response

    return ok(await updateLead(auth.tenantId, id, parsed.data, auth.actor))
  } catch (error) {
    return handleError(error)
  }
}
