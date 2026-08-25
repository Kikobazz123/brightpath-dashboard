"use server"

/**
 * Lead capture from the public website.
 *
 * This is the front door in the case study: a visitor fills in a form on the
 * marketing site and, by the time anyone opens the record, the assistant has
 * already read it, scored it, drafted a reply and named a next action. The
 * whole product exists because that gap used to be hours or days.
 *
 * Deliberately separate from `captureLead` in `./actions`, which is the
 * dashboard's version. Two differences, both about who is calling:
 *
 *   - It returns no lead id. A stranger has no business holding an identifier
 *     for a record they cannot see, and handing one out invites someone to try.
 *   - It is rate limited, because it is unauthenticated and runs the AI
 *     pipeline. An open endpoint that spends model quota is the one that gets
 *     hammered, and the cost of that is real leads going unanalysed.
 */

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { createLeadSchema } from "@/lib/contracts/leads"
import { CAPTURE_LIMIT, rateLimit } from "@/lib/api/rate-limit"
import { acknowledgeEnquiry, notifyNewEnquiry } from "@/lib/mail/service"
import { createLead, getLead, runFullPipeline } from "@/lib/leads/service"
import { tenantId } from "@/lib/client/server-data"

export type PublicCaptureResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

/**
 * Best-effort caller identity.
 *
 * Behind a proxy the socket address is the proxy, so forwarded headers are all
 * there is. They are client-controlled and spoofable, which is why this is a
 * speed bump rather than a security control — the same caveat that applies to
 * the HTTP route's limiter.
 */
async function clientKey(): Promise<string> {
  const store = await headers()
  const forwarded = store.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return store.get("x-real-ip")?.trim() || "unknown"
}

export async function submitPublicLead(
  formData: FormData,
): Promise<PublicCaptureResult> {
  const text = (key: string): string | null => {
    const value = formData.get(key)
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  const limit = rateLimit(`public-capture:${await clientKey()}`, CAPTURE_LIMIT)
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many submissions. Try again in about ${limit.retryAfterSeconds} seconds.`,
    }
  }

  const name = [text("firstName"), text("lastName")].filter(Boolean).join(" ")
  const email = text("email")
  const message = text("message") ?? ""

  if (!email) {
    return { ok: false, message: "An email address is required so we can reply." }
  }
  if (message.length < 10) {
    return {
      ok: false,
      message: "Tell us a little about the problem — a sentence or two is plenty.",
    }
  }

  const parsed = createLeadSchema.safeParse({
    source: "website",
    contact: {
      name: name || null,
      email,
      phone: null,
      role: text("role"),
    },
    company: text("company"),
    company_size: null,
    industry: null,
    budget: null,
    need: null,
    interest_level: null,
    message,
    extra: {},
  })

  if (!parsed.success) {
    // Field-level detail belongs to the operator, not to a website visitor.
    return {
      ok: false,
      message: "Those details could not be submitted. Check the email address.",
    }
  }

  let lead
  try {
    lead = await createLead(tenantId(), parsed.data, "website-form")
  } catch (error) {
    console.error("[public-capture] could not store lead", error)
    return {
      ok: false,
      message:
        "We could not record that just now. Please email us directly instead.",
    }
  }

  /**
   * The lead is saved before the assistant runs, and a failure here is not
   * reported to the visitor.
   *
   * From their side the enquiry did arrive — it is on the board, a rep will
   * see it, and the SLA clock is running. Whether the model was available in
   * that moment is our operational problem, and telling a prospective customer
   * "submitted, but our AI is rate limited" would be both alarming and
   * irrelevant to them.
   */
  try {
    await runFullPipeline(tenantId(), lead.id)
  } catch (error) {
    console.error("[public-capture] pipeline failed, lead retained", error)
  }

  /**
   * Notify the connected mailbox, and acknowledge to the sender.
   *
   * Deliberately after the pipeline, so the alert can carry the score — the
   * difference between "a form was submitted" and "this one is worth opening
   * now". Re-read rather than reusing `lead`, which was captured before the
   * pipeline ran and has no assessment on it.
   *
   * Failures are logged and swallowed for the same reason the pipeline's are:
   * the enquiry did arrive, it is on the board, and a visitor cannot act on
   * "stored, but our SMTP credentials have expired".
   */
  try {
    const analysed = await getLead(tenantId(), lead.id)

    const notified = await notifyNewEnquiry(analysed)
    if (notified.attempted && !notified.ok) {
      console.error("[public-capture] enquiry notification failed", notified.reason)
    }

    const acknowledged = await acknowledgeEnquiry(analysed)
    if (acknowledged.attempted && !acknowledged.ok) {
      console.error("[public-capture] acknowledgement failed", acknowledged.reason)
    }
  } catch (error) {
    console.error("[public-capture] mail step failed, lead retained", error)
  }

  revalidatePath("/leads")
  revalidatePath("/dashboard")
  revalidatePath("/mail")

  return {
    ok: true,
    message:
      "Thanks — your enquiry is with us. Someone will come back to you shortly.",
  }
}
