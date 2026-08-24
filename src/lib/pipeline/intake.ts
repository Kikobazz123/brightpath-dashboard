import type { CreateLeadInput, SlaState } from "@/lib/contracts/leads"

import { slaMinutes } from "./rubric"

/**
 * Intake — deterministic normalisation before any model sees the lead.
 *
 * Two outputs, kept separate on purpose. `raw_context` is exactly what arrived
 * and is never edited, so an extraction can be re-run and audited months later.
 * `normalized_context` is the tidied version the analyst reads.
 */

/** Collapse whitespace and strip the boilerplate forms tend to append. */
function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const LABELS: Record<string, string> = {
  company: "Company",
  company_size: "Company size",
  industry: "Industry",
  budget: "Budget",
  need: "Stated need",
  interest_level: "Interest level",
}

export interface NormalizedIntake {
  rawContext: string
  normalizedContext: string
}

/**
 * Build the two context strings.
 *
 * Structured form fields are rendered as labelled lines so the analyst can quote
 * them verbatim — the source-span check requires that whatever it quotes appears
 * in the text it was given, so the fields have to be present in prose form.
 */
export function normalizeIntake(input: CreateLeadInput): NormalizedIntake {
  const parts: string[] = []

  const contact = input.contact ?? {}
  const contactBits = [
    contact.name && `Name: ${contact.name}`,
    contact.email && `Email: ${contact.email}`,
    contact.phone && `Phone: ${contact.phone}`,
    contact.role && `Role: ${contact.role}`,
  ].filter(Boolean)
  if (contactBits.length) parts.push(contactBits.join("\n"))

  const fields = (["company", "company_size", "industry", "budget", "need", "interest_level"] as const)
    .map((key) => {
      const value = input[key]
      return value ? `${LABELS[key]}: ${value}` : null
    })
    .filter(Boolean) as string[]
  if (fields.length) parts.push(fields.join("\n"))

  for (const [key, value] of Object.entries(input.extra ?? {})) {
    if (value) parts.push(`${key}: ${value}`)
  }

  if (input.message) parts.push(`Message:\n${input.message}`)

  parts.push(`Source: ${input.source}`)

  const raw = parts.join("\n\n")
  return { rawContext: raw, normalizedContext: tidy(raw) }
}

/* ------------------------------------------------------------------ *
 * Speed-to-lead clock
 * ------------------------------------------------------------------ */

export function firstTouchDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + slaMinutes() * 60 * 1000)
}

/**
 * Resolve the SLA state.
 *
 * Three states, and the distinction matters: `pending` means the clock is still
 * running, `met` means a rep acted in time, `breached` means the exact failure
 * BrightPath described — a lead arrived and waited. Once breached, it stays
 * breached even after someone finally responds, because the miss is a fact and
 * hiding it would make the metric useless.
 */
export function resolveSlaState(
  dueAt: Date,
  firstTouchAt: Date | null,
  now: Date = new Date(),
): SlaState {
  if (firstTouchAt) return firstTouchAt <= dueAt ? "met" : "breached"
  return now > dueAt ? "breached" : "pending"
}

/** Minutes a lead waited, or has been waiting. Powers the dashboard tiles. */
export function waitMinutes(
  createdAt: Date,
  firstTouchAt: Date | null,
  now: Date = new Date(),
): number {
  const end = firstTouchAt ?? now
  return Math.max(0, Math.round((end.getTime() - createdAt.getTime()) / 60000))
}

/**
 * Actions that count as a real first touch.
 *
 * Drafting a message is not contact — the lead experiences nothing. Only
 * approving, sending, or a human moving the lead's status stops the clock.
 * Counting a draft would let the system report an SLA it never met.
 */
export const FIRST_TOUCH_ACTIVITIES = [
  "follow_up_approved",
  "follow_up_sent",
  "status_changed",
  "owner_assigned",
] as const
