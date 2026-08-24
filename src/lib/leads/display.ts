/**
 * How the domain enums are rendered.
 *
 * Pure data and pure functions, no React — so a Server Component and a Client
 * Component can both import it without dragging a runtime across the boundary.
 *
 * It exists because "HIGH" as a red pill in one view and a grey pill in another
 * teaches a rep to distrust the colour, and colour is the whole point of a
 * triage list. One map, read everywhere.
 */

import type {
  ActivityType,
  FollowUpState,
  LeadSource,
  LeadStatus,
  NextActionType,
  Priority,
  QualificationStatus,
  Signal,
  SlaState,
} from "@/lib/contracts/leads"

/** Semantic tone, mapped to concrete classes once in `toneClass`. */
export type Tone = "critical" | "warning" | "positive" | "info" | "neutral"

export const TONE_CLASS: Record<Tone, string> = {
  critical:
    "border-transparent bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  warning:
    "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  positive:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  neutral:
    "border-transparent bg-muted text-muted-foreground dark:bg-muted/60",
}

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone]
}

/* ------------------------------------------------------------------ *
 * Priority
 * ------------------------------------------------------------------ */

export const PRIORITY_TONE: Record<Priority, Tone> = {
  HIGH: "critical",
  MEDIUM: "warning",
  LOW: "neutral",
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
}

/* ------------------------------------------------------------------ *
 * Qualification
 * ------------------------------------------------------------------ */

export const QUALIFICATION_TONE: Record<QualificationStatus, Tone> = {
  QUALIFIED: "positive",
  NOT_QUALIFIED: "neutral",
  NEEDS_REVIEW: "warning",
  NOT_ASSESSED: "neutral",
}

export const QUALIFICATION_LABEL: Record<QualificationStatus, string> = {
  QUALIFIED: "Qualified",
  NOT_QUALIFIED: "Not qualified",
  NEEDS_REVIEW: "Needs review",
  NOT_ASSESSED: "Not assessed",
}

/**
 * Why the assistant landed where it did — shown next to the badge so the state
 * reads as a decision rather than a mood.
 */
export const QUALIFICATION_MEANING: Record<QualificationStatus, string> = {
  QUALIFIED: "Clears the rubric threshold and is worth a rep's time.",
  NOT_QUALIFIED: "Scored below the threshold on the evidence available.",
  NEEDS_REVIEW:
    "Required evidence is missing, so no score was published. A human decides.",
  NOT_ASSESSED: "The assistant has not run on this lead yet.",
}

/* ------------------------------------------------------------------ *
 * Sales status — human-owned
 * ------------------------------------------------------------------ */

export const STATUS_TONE: Record<LeadStatus, Tone> = {
  new: "info",
  contacted: "info",
  engaged: "positive",
  meeting_booked: "positive",
  won: "positive",
  lost: "neutral",
  disqualified: "neutral",
}

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  meeting_booked: "Meeting booked",
  won: "Won",
  lost: "Lost",
  disqualified: "Disqualified",
}

/* ------------------------------------------------------------------ *
 * Follow-up state
 * ------------------------------------------------------------------ */

export const FOLLOW_UP_TONE: Record<FollowUpState, Tone> = {
  none: "neutral",
  drafted: "info",
  approved: "info",
  sent: "positive",
  replied: "positive",
  due: "warning",
  overdue: "critical",
}

export const FOLLOW_UP_LABEL: Record<FollowUpState, string> = {
  none: "No draft",
  drafted: "Drafted",
  approved: "Approved",
  sent: "Sent",
  replied: "Replied",
  due: "Due",
  overdue: "Overdue",
}

/* ------------------------------------------------------------------ *
 * Speed-to-lead
 * ------------------------------------------------------------------ */

export const SLA_TONE: Record<SlaState, Tone> = {
  pending: "warning",
  met: "positive",
  breached: "critical",
}

export const SLA_LABEL: Record<SlaState, string> = {
  pending: "Awaiting first touch",
  met: "Responded in time",
  breached: "SLA breached",
}

/* ------------------------------------------------------------------ *
 * Source
 * ------------------------------------------------------------------ */

export const SOURCE_LABEL: Record<LeadSource, string> = {
  website: "Website",
  referral: "Referral",
  social: "Social",
  event: "Event",
  advertising: "Advertising",
  import: "Import",
  crm: "CRM",
  other: "Other",
}

/* ------------------------------------------------------------------ *
 * Signals
 * ------------------------------------------------------------------ */

export const SIGNAL_LABEL: Record<Signal, string> = {
  company_fit: "Company fit",
  industry_fit: "Industry fit",
  need: "Need",
  budget: "Budget",
  interest: "Interest",
}

export const SIGNAL_DESCRIPTION: Record<Signal, string> = {
  company_fit: "Headcount band against BrightPath's SMB sweet spot.",
  industry_fit: "Whether the sector is one BrightPath can show proof in.",
  need: "A stated problem BrightPath solves, in the lead's own words.",
  budget: "Stated spend, or a clear signal that spend exists.",
  interest: "How actively the lead is asking to move forward.",
}

/* ------------------------------------------------------------------ *
 * Next action
 * ------------------------------------------------------------------ */

export const NEXT_ACTION_LABEL: Record<NextActionType, string> = {
  call_now: "Call now",
  schedule_call: "Schedule a call",
  send_information: "Send information",
  request_information: "Request missing information",
  nurture: "Nurture",
  route_to_rep: "Route to a rep",
  disqualify: "Disqualify",
}

export const NEXT_ACTION_TONE: Record<NextActionType, Tone> = {
  call_now: "critical",
  schedule_call: "positive",
  send_information: "info",
  request_information: "warning",
  nurture: "neutral",
  route_to_rep: "info",
  disqualify: "neutral",
}

/* ------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------ */

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  lead_created: "Lead captured",
  lead_imported: "Lead imported",
  lead_updated: "Lead updated",
  analyzed: "Evidence extracted",
  scored: "Scored against rubric",
  follow_up_drafted: "Follow-up drafted",
  follow_up_approved: "Follow-up approved",
  follow_up_sent: "Follow-up sent",
  reply_received: "Reply received",
  next_action_recommended: "Next action recommended",
  status_changed: "Status changed",
  owner_assigned: "Owner assigned",
  sla_breached: "SLA breached",
  error: "Error",
}

export const ACTIVITY_TONE: Record<ActivityType, Tone> = {
  lead_created: "info",
  lead_imported: "info",
  lead_updated: "neutral",
  analyzed: "info",
  scored: "info",
  follow_up_drafted: "info",
  follow_up_approved: "info",
  follow_up_sent: "positive",
  reply_received: "positive",
  next_action_recommended: "info",
  status_changed: "positive",
  owner_assigned: "neutral",
  sla_breached: "critical",
  error: "critical",
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/**
 * Absolute timestamps everywhere, in UTC.
 *
 * A sales timeline gets read as evidence of when someone responded, and
 * "2 hours ago" cannot be checked against an email header. Relative text is
 * used only as a companion to the absolute value, never as a replacement.
 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "in 12m" / "3h ago". Deterministic given `now`, so it can be tested. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const deltaMs = new Date(iso).getTime() - now.getTime()
  const past = deltaMs < 0
  const minutes = Math.round(Math.abs(deltaMs) / 60_000)

  if (minutes < 1) return "just now"

  const render = (value: number, unit: string) =>
    past ? `${value}${unit} ago` : `in ${value}${unit}`

  if (minutes < 60) return render(minutes, "m")

  const hours = Math.round(minutes / 60)
  if (hours < 24) return render(hours, "h")

  return render(Math.round(hours / 24), "d")
}

/** Minutes as "1h 12m" — how the SLA clock reads in a tile. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—"
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** Confidence as a whole-number percentage. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

/** What to call a lead when the company field is empty. */
export function leadTitle(input: {
  company: string | null
  contact_name?: string | null
  contact?: { name: string | null }
}): string {
  const contactName = input.contact_name ?? input.contact?.name ?? null
  return input.company || contactName || "Unnamed lead"
}
