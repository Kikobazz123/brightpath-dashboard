import type { Lead } from "@/lib/contracts/leads"
import { siteConfig } from "@/config/site"

/**
 * Leads, shaped like email.
 *
 * The Inbox used to render `data.tsx` — Alicia Koch's fictional mailbox, nine
 * hard-coded messages about weekend hiking plans, shipped with the theme. It
 * now renders what actually arrived: every enquiry captured through the website
 * form or typed up by a rep, in the same mailbox metaphor.
 *
 * This adapter is the whole seam. Nothing downstream of it knows it is looking
 * at a lead rather than a message, which is why the list, the reading pane and
 * the search box needed no changes to start showing real data.
 *
 * The demo mailbox is deliberately left in place at `./data` and is no longer
 * imported. Deleting it would be tidier; keeping it means the upstream template
 * can still be diffed against this fork without a phantom file.
 */

export interface InboxMessage {
  id: string
  name: string
  email: string
  subject: string
  text: string
  date: string
  read: boolean
  labels: string[]
  /** Passed through so the reading pane can link back to the real record. */
  leadId: string
}

/** The connected mailbox, as the account switcher shows it. */
export const inboxAccount = {
  label: siteConfig.name,
  email: siteConfig.email,
}

/**
 * A subject line, since an enquiry form has no subject field.
 *
 * Built from what the person actually gave us rather than from the assistant's
 * output — a subject reading "High-priority lead, score 82" would be the
 * dashboard talking to itself, not a description of the message.
 */
function subjectFor(lead: Lead): string {
  if (lead.need) return lead.need
  if (lead.company) return `Enquiry from ${lead.company}`
  if (lead.contact.name) return `Enquiry from ${lead.contact.name}`
  return "Website enquiry"
}

/**
 * Labels a person can scan.
 *
 * Priority first because it is what decides whether to open this now, then the
 * channel it came in on, then whether it has been answered. Only facts already
 * on the record — nothing here is computed for display.
 */
function labelsFor(lead: Lead): string[] {
  const labels: string[] = []

  if (lead.assessment?.priority) labels.push(lead.assessment.priority)
  labels.push(lead.source)

  if (lead.follow_up_state === "sent" || lead.follow_up_state === "replied") {
    labels.push("answered")
  } else if (lead.follow_up_state === "drafted") {
    labels.push("draft ready")
  }

  if (lead.sla_state === "breached") labels.push("overdue")

  return labels
}

/**
 * What the person actually wrote.
 *
 * `raw_context` is the intake record, not a message: `normalizeIntake` prefixes
 * it with Name / Email / Phone / Role and the structured fields, and appends
 * the source, so rendering it whole makes every enquiry open with its own
 * address block. That is right for the analyst — it is the audit copy, and it
 * stays untouched — and wrong for an inbox, where the header already shows who
 * sent it.
 *
 * So the `Message:` section is lifted back out. Anything that arrived without
 * one — a webhook import, a lead entered as fields only — falls back to the
 * whole record, because showing all of it beats showing nothing.
 */
function bodyOf(lead: Lead): string {
  const raw = lead.raw_context
  const start = raw.indexOf("Message:\n")
  if (start === -1) return raw || "(no message)"

  const after = raw.slice(start + "Message:\n".length)
  const end = after.indexOf("\n\nSource:")
  const body = (end === -1 ? after : after.slice(0, end)).trim()

  return body || raw
}

export function toInboxMessage(lead: Lead): InboxMessage {
  return {
    id: lead.id,
    leadId: lead.id,
    name: lead.contact.name ?? lead.company ?? "Unknown sender",
    email: lead.contact.email ?? "no address given",
    subject: subjectFor(lead),
    text: bodyOf(lead),
    date: lead.created_at,
    /**
     * "Read" means someone has done something about it, not that a pixel was
     * rendered. An enquiry nobody has touched shows bold, which is the only
     * thing the unread state is good for.
     */
    read: lead.first_touch_at !== null || lead.status !== "new",
    labels: labelsFor(lead),
  }
}

export function toInboxMessages(leads: Lead[]): InboxMessage[] {
  return leads.map(toInboxMessage)
}

/** Counts for the folder rail. Empty folders render without a badge. */
export function inboxCounts(messages: InboxMessage[]) {
  return {
    all: messages.length,
    unread: messages.filter((message) => !message.read).length,
    website: messages.filter((message) => message.labels.includes("website"))
      .length,
    answered: messages.filter((message) => message.labels.includes("answered"))
      .length,
    overdue: messages.filter((message) => message.labels.includes("overdue"))
      .length,
  }
}
