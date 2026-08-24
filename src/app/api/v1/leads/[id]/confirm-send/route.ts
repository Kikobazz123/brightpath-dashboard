import { confirmSendSchema } from "@/lib/contracts/leads"
import {
  handleError,
  isResponse,
  ok,
  parseBody,
  requireAuth,
} from "@/lib/api/http"
import { confirmSend } from "@/lib/leads/service"
import { observe } from "@/lib/api/observability"

/**
 * Record that a follow-up was actually delivered.
 *
 * The only route that can set state to 'sent', and it requires a provider name
 * and that provider's message id. Without a receipt there is no claim — the
 * system will say 'drafted' forever rather than assert a send it cannot prove.
 */
async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(request)
    if (isResponse(auth)) return auth
    const { id } = await params

    const parsed = await parseBody(request, confirmSendSchema)
    if ("response" in parsed) return parsed.response

    return ok(
      await confirmSend(
        auth.tenantId,
        id,
        parsed.data.provider,
        parsed.data.provider_message_id,
        new Date(parsed.data.sent_at),
        auth.actor,
      ),
    )
  } catch (error) {
    return handleError(error)
  }
}

export const POST = observe("POST /api/v1/leads/[id]/confirm-send", handlePOST)

export const dynamic = "force-dynamic"
