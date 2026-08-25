import { siteConfig } from "@/config/site"

/**
 * The bodies of the two emails this app sends on its own.
 *
 * Plain text, no HTML. A notification to your own inbox gains nothing from a
 * template, and a first reply to a prospect that arrives looking like a
 * marketing blast is the wrong first impression for a company whose pitch is
 * that a human reads what you sent.
 */

export interface EnquiryNotification {
  leadId: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  company: string | null
  role: string | null
  source: string
  message: string
  score: number | null
  priority: string | null
  qualification: string
  appUrl: string | null
}

/** Where a rep should click through to. Absolute in production, relative locally. */
export function leadUrl(leadId: string): string | null {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "")

  return base ? `${base.replace(/\/$/, "")}/leads/${leadId}` : null
}

/**
 * "Someone filled in the form."
 *
 * Leads with the assessment attached, so the subject line alone tells you
 * whether this one needs answering in the next ten minutes. The line is
 * omitted entirely rather than guessed at when the pipeline has not run.
 */
export function enquiryNotification(lead: EnquiryNotification): {
  subject: string
  text: string
} {
  const who = lead.contactName || lead.contactEmail || "Someone"
  const where = lead.company ? ` at ${lead.company}` : ""
  const flag = lead.priority ? `[${lead.priority.toUpperCase()}] ` : ""

  const facts: string[] = [
    `From:     ${lead.contactName ?? "not given"}`,
    `Email:    ${lead.contactEmail ?? "not given"}`,
    `Phone:    ${lead.contactPhone ?? "not given"}`,
    `Company:  ${lead.company ?? "not given"}`,
    `Role:     ${lead.role ?? "not given"}`,
    `Source:   ${lead.source}`,
  ]

  if (lead.score !== null) {
    facts.push(`Score:    ${lead.score}/100 (${lead.qualification})`)
  } else {
    facts.push(`Score:    not assessed yet`)
  }

  const link = lead.appUrl
    ? `\n\nOpen the lead:\n${lead.appUrl}`
    : `\n\nOpen the lead in the dashboard under Leads — id ${lead.leadId}.`

  return {
    subject: `${flag}New website enquiry — ${who}${where}`,
    text: [
      `${who}${where} sent an enquiry through the website.`,
      "",
      facts.join("\n"),
      "",
      "What they wrote",
      "───────────────",
      lead.message.trim() || "(no message)",
      link,
      "",
      "—",
      `Sent automatically by the ${siteConfig.shortName} sales assistant.`,
    ].join("\n"),
  }
}

/**
 * The acknowledgement a person gets for filling in the form.
 *
 * Promises only what the system can keep: that it arrived and that a human
 * will read it. No pricing, no next steps, no "a member of our team will be in
 * touch within 24 hours" unless someone is actually watching the inbox.
 */
export function enquiryAcknowledgement(contactName: string | null): {
  subject: string
  text: string
} {
  const greeting = contactName ? `Hi ${contactName.split(" ")[0]},` : "Hi,"

  return {
    subject: `We have your enquiry — ${siteConfig.shortName}`,
    text: [
      greeting,
      "",
      `Thanks for getting in touch with ${siteConfig.name}. Your enquiry has`,
      "reached us and a person will read it — this note is only to confirm it",
      "did not vanish into a form.",
      "",
      "If anything has changed in the meantime, or you would rather just talk,",
      "reply to this email and it comes straight back to us.",
      "",
      siteConfig.shortName,
      siteConfig.tagline,
    ].join("\n"),
  }
}
