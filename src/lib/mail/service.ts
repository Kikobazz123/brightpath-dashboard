import { siteConfig } from "@/config/site"
import type { Lead } from "@/lib/contracts/leads"
import { confirmSend, logActivity } from "@/lib/leads/service"

import {
  enquiryAcknowledgement,
  enquiryNotification,
  leadUrl,
} from "./messages"
import { isMailConfigured, notificationInbox, sendMail } from "./transport"

/**
 * Email, in terms of leads rather than in terms of SMTP.
 *
 * Two jobs live here. Inbound: a website enquiry lands, and the connected
 * mailbox is told about it — that is what makes the form worth having when
 * nobody has the dashboard open. Outbound: the drafted follow-up is actually
 * sent, and the send is recorded with the message id the server returned.
 *
 * Nothing in this file is allowed to fail the operation that called it. A lead
 * that was captured is captured whether or not the notification went out; the
 * caller gets told what happened and decides how loudly to say so.
 */

export interface MailOutcome {
  attempted: boolean
  ok: boolean
  /** Present when `ok` is false. Safe to show a user. */
  reason?: string
  messageId?: string
}

const SKIPPED: MailOutcome = { attempted: false, ok: false }

/**
 * Tell the connected mailbox that a website enquiry arrived.
 *
 * Called after the pipeline has run where possible, so the notification can
 * carry the score — that is the difference between "a form was submitted" and
 * "this one is worth interrupting your afternoon for".
 */
export async function notifyNewEnquiry(lead: Lead): Promise<MailOutcome> {
  const inbox = notificationInbox()
  if (!inbox) return SKIPPED

  const notification = enquiryNotification({
    leadId: lead.id,
    contactName: lead.contact?.name ?? null,
    contactEmail: lead.contact?.email ?? null,
    contactPhone: lead.contact?.phone ?? null,
    company: lead.company,
    role: lead.contact?.role ?? null,
    source: lead.source,
    message: lead.raw_context,
    score: lead.assessment?.score ?? null,
    priority: lead.assessment?.priority ?? null,
    qualification: lead.assessment?.qualification_status ?? "NOT_ASSESSED",
    appUrl: leadUrl(lead.id),
  })

  const result = await sendMail({
    to: inbox,
    subject: notification.subject,
    text: notification.text,
    // Replying to the alert replies to the prospect, not to ourselves.
    replyTo: lead.contact?.email ?? undefined,
  })

  if (!result.ok) {
    return { attempted: true, ok: false, reason: result.reason }
  }

  await safelyLog(lead, "notification_sent", {
    to: inbox,
    provider: result.provider,
    provider_message_id: result.messageId,
  })

  return { attempted: true, ok: true, messageId: result.messageId }
}

/**
 * Acknowledge the enquiry to the person who sent it.
 *
 * Separate from the notification on purpose — one goes to us and one goes to a
 * customer, and the second is the one that does damage if it fires when it
 * should not have. Only ever sent to an address the person typed themselves.
 */
export async function acknowledgeEnquiry(lead: Lead): Promise<MailOutcome> {
  const to = lead.contact?.email
  if (!to) return SKIPPED
  if (!isMailConfigured()) return SKIPPED

  const body = enquiryAcknowledgement(lead.contact?.name ?? null)
  const result = await sendMail({ to, subject: body.subject, text: body.text })

  if (!result.ok) {
    return { attempted: true, ok: false, reason: result.reason }
  }

  await safelyLog(lead, "acknowledgement_sent", {
    to,
    provider: result.provider,
    provider_message_id: result.messageId,
  })

  return { attempted: true, ok: true, messageId: result.messageId }
}

/**
 * Send the drafted follow-up for real, then record it.
 *
 * The order matters and is not an accident. The message goes out first; only
 * once the server has handed back a message id is `confirmSend` called, and
 * that id is what it stores. If the send fails, nothing is written and the lead
 * stays `drafted` — which is true, and is the state a rep can act on.
 *
 * This is the same contract the manual "Record a send" dialog satisfies. The
 * dialog still exists for a rep who sends from their own client; this path just
 * fills in the proof automatically because it genuinely has it.
 */
export async function sendFollowUp(
  tenantId: string,
  lead: Lead,
  actor: string,
): Promise<
  | { ok: true; lead: Lead; messageId: string }
  | { ok: false; reason: string }
> {
  const to = lead.contact?.email
  if (!to) {
    return {
      ok: false,
      reason: "This lead has no email address, so there is nowhere to send it.",
    }
  }

  const draft = lead.follow_up
  if (!draft) {
    return {
      ok: false,
      reason: "There is no drafted follow-up to send yet.",
    }
  }

  const result = await sendMail({
    to,
    subject: draft.subject,
    text: draft.message,
  })

  if (!result.ok) {
    return {
      ok: false,
      reason: result.configured
        ? result.reason
        : `${result.reason} Until then, copy the draft and send it from your own client.`,
    }
  }

  const updated = await confirmSend(
    tenantId,
    lead.id,
    result.provider,
    result.messageId,
    new Date(),
    actor,
  )

  return { ok: true, lead: updated, messageId: result.messageId }
}

/**
 * Send an arbitrary message to a lead's address — the Inbox reply box.
 *
 * Deliberately does not touch `follow_up_state`. A reply typed by hand is
 * correspondence, not the drafted follow-up, and letting it flip the lead to
 * `sent` would make the pipeline state a lie about which message went out.
 */
export async function replyToLead(
  lead: Lead,
  subject: string,
  body: string,
): Promise<MailOutcome> {
  const to = lead.contact?.email
  if (!to) {
    return {
      attempted: false,
      ok: false,
      reason: "This lead has no email address.",
    }
  }

  const result = await sendMail({ to, subject, text: body })
  if (!result.ok) {
    return { attempted: true, ok: false, reason: result.reason }
  }

  await safelyLog(lead, "reply_sent", {
    to,
    subject,
    provider: result.provider,
    provider_message_id: result.messageId,
  })

  return { attempted: true, ok: true, messageId: result.messageId }
}

/**
 * Send a plain message to any address, used to prove the connection works.
 *
 * Not tied to a lead, because the thing being tested is the mailbox rather
 * than the pipeline.
 */
export async function sendTestMessage(to: string): Promise<MailOutcome> {
  const result = await sendMail({
    to,
    subject: `Test message from ${siteConfig.shortName}`,
    text: [
      "This is a test message from the Brightpath sales assistant.",
      "",
      "If you are reading it, the mailbox is connected: enquiries captured on",
      "the website will be delivered here, and follow-ups drafted in the",
      "dashboard can be sent for real rather than copied out by hand.",
      "",
      "Nothing else was sent, and this address was not stored.",
    ].join("\n"),
  })

  return result.ok
    ? { attempted: true, ok: true, messageId: result.messageId }
    : { attempted: true, ok: false, reason: result.reason }
}

/**
 * Activity logging that cannot break a send that already happened.
 *
 * `activity_type` is a database enum and none of these mail events are in it,
 * so they are recorded as `lead_updated` with a `kind` in the payload. Adding
 * enum members would be the tidier answer and needs a migration; this keeps the
 * audit trail complete without one. If the write fails anyway, the email has
 * still gone out and saying otherwise would be worse than a gap in the log.
 */
async function safelyLog(
  lead: Lead,
  kind: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await logActivity(
      process.env.DEMO_TENANT_ID?.trim() || "brightpath",
      lead.id,
      "lead_updated",
      "system",
      { kind, ...payload },
    )
  } catch {
    // Intentionally swallowed. See the doc comment.
  }
}
