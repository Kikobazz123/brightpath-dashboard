import { z } from "zod"

/**
 * BrightPath AI Sales Assistant — the API contract.
 *
 * This file is the single source of truth shared by the API and the dashboard.
 * Routes validate with these schemas; UI imports the inferred types. Neither side
 * redefines a shape, so the two cannot drift apart silently.
 *
 * Three concepts are kept deliberately separate throughout, because collapsing
 * them is how a sales tool starts lying:
 *
 *   Evidence   — what the lead actually told us, with the source text to prove it
 *   Assessment — what the system computed from that evidence, and why
 *   Disposition— what a human decided, which the system never sets on its own
 */

/* ------------------------------------------------------------------ *
 * Enumerations
 * ------------------------------------------------------------------ */

export const LEAD_SOURCES = [
  "website",
  "referral",
  "social",
  "event",
  "advertising",
  "import",
  "crm",
  "other",
] as const
export const leadSourceSchema = z.enum(LEAD_SOURCES)
export type LeadSource = z.infer<typeof leadSourceSchema>

/**
 * The five qualification signals. These mirror BANT (Budget, Authority, Need,
 * Timing) adapted for SMB software sales, where fit matters more than the
 * authority question — in an SMB the buyer is usually the decision maker.
 * Changing this list means changing the rubric; they are versioned together.
 */
export const SIGNALS = [
  "company_fit",
  "industry_fit",
  "need",
  "budget",
  "interest",
] as const
export const signalSchema = z.enum(SIGNALS)
export type Signal = z.infer<typeof signalSchema>

export const COMPANY_SIZE_BANDS = [
  "1-9",
  "10-49",
  "50-249",
  "250-999",
  "1000+",
] as const
export const companySizeSchema = z.enum(COMPANY_SIZE_BANDS)
export type CompanySize = z.infer<typeof companySizeSchema>

export const INTEREST_LEVELS = ["low", "medium", "high"] as const
export const interestLevelSchema = z.enum(INTEREST_LEVELS)
export type InterestLevel = z.infer<typeof interestLevelSchema>

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const
export const prioritySchema = z.enum(PRIORITIES)
export type Priority = z.infer<typeof prioritySchema>

/**
 * NEEDS_REVIEW is not a failure state. It is the honest answer when the
 * evidence is too thin to justify a number, and it is what the system returns
 * instead of guessing.
 */
export const QUALIFICATION_STATUSES = [
  "QUALIFIED",
  "NOT_QUALIFIED",
  "NEEDS_REVIEW",
  "NOT_ASSESSED",
] as const
export const qualificationStatusSchema = z.enum(QUALIFICATION_STATUSES)
export type QualificationStatus = z.infer<typeof qualificationStatusSchema>

/** Where the human has taken the lead. Only a person moves this. */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "engaged",
  "meeting_booked",
  "won",
  "lost",
  "disqualified",
] as const
export const leadStatusSchema = z.enum(LEAD_STATUSES)
export type LeadStatus = z.infer<typeof leadStatusSchema>

/**
 * `sent` may only be written when a real sending integration confirms delivery.
 * Drafting a message is not sending it, and the difference is the difference
 * between a truthful tool and a demo that lies to its user.
 */
export const FOLLOW_UP_STATES = [
  "none",
  "drafted",
  "approved",
  "sent",
  "replied",
  "due",
  "overdue",
] as const
export const followUpStateSchema = z.enum(FOLLOW_UP_STATES)
export type FollowUpState = z.infer<typeof followUpStateSchema>

/** Speed-to-lead. `pending` before first touch, then met or breached. */
export const SLA_STATES = ["pending", "met", "breached"] as const
export const slaStateSchema = z.enum(SLA_STATES)
export type SlaState = z.infer<typeof slaStateSchema>

export const NEXT_ACTION_TYPES = [
  "call_now",
  "schedule_call",
  "send_information",
  "request_information",
  "nurture",
  "route_to_rep",
  "disqualify",
] as const
export const nextActionTypeSchema = z.enum(NEXT_ACTION_TYPES)
export type NextActionType = z.infer<typeof nextActionTypeSchema>

/* ------------------------------------------------------------------ *
 * Evidence — what the lead told us, and where it said so
 * ------------------------------------------------------------------ */

/**
 * One signal's worth of evidence.
 *
 * `source_span` is a verbatim quote from the lead's own text. It exists so a
 * claim can be checked rather than trusted: if the system says the budget is
 * £20k, the span shows the sentence that said so. A signal with no supporting
 * text is `present: false` — never a plausible-sounding guess.
 */
export const evidenceItemSchema = z
  .object({
    signal: signalSchema,
    present: z.boolean(),
    /** Normalized reading of the signal, e.g. "50-249 employees". */
    value: z.string().min(1).nullable(),
    /** Verbatim excerpt from the lead input that supports `value`. */
    source_span: z.string().min(1).nullable(),
    /** How clearly the source supports the value, 0–1. */
    confidence: z.number().min(0).max(1),
    /** Optional analyst remark, e.g. an ambiguity worth a human's eye. */
    note: z.string().nullable().default(null),
  })
  .refine((e) => e.present || (e.value === null && e.source_span === null), {
    message:
      "A signal marked absent cannot carry a value or a source span — that would be fabrication.",
    path: ["value"],
  })
  .refine((e) => !e.present || e.source_span !== null, {
    message:
      "A signal marked present must cite the source text it was drawn from.",
    path: ["source_span"],
  })
export type EvidenceItem = z.infer<typeof evidenceItemSchema>

export const evidenceSchema = z.object({
  items: z.array(evidenceItemSchema),
  /** Anything the analyst noticed that does not belong to a scored signal. */
  context_notes: z.array(z.string()).default([]),
  extracted_at: z.string().datetime(),
  model: z.string(),
})
export type Evidence = z.infer<typeof evidenceSchema>

/* ------------------------------------------------------------------ *
 * Assessment — computed from evidence by deterministic code
 * ------------------------------------------------------------------ */

export const scoreReasonSchema = z.object({
  signal: signalSchema,
  points_awarded: z.number(),
  points_possible: z.number(),
  direction: z.enum(["positive", "negative", "neutral"]),
  /** Plain-language explanation tied to a rubric line, not model prose. */
  explanation: z.string(),
})
export type ScoreReason = z.infer<typeof scoreReasonSchema>

/**
 * The result of scoring.
 *
 * `score` and `priority` are null when the status is NEEDS_REVIEW or
 * NOT_ASSESSED. A withheld number is information; an invented one is damage.
 */
export const scoreResultSchema = z
  .object({
    rubric_version: z.string(),
    score: z.number().int().min(0).max(100).nullable(),
    priority: prioritySchema.nullable(),
    qualification_status: qualificationStatusSchema,
    /** Share of signals backed by real evidence, 0–1. */
    confidence: z.number().min(0).max(1),
    reasons: z.array(scoreReasonSchema),
    missing_information: z.array(signalSchema),
    scored_at: z.string().datetime(),
  })
  .refine(
    (s) =>
      s.qualification_status === "NEEDS_REVIEW" ||
      s.qualification_status === "NOT_ASSESSED"
        ? s.score === null && s.priority === null
        : s.score !== null && s.priority !== null,
    {
      message:
        "A score and priority must be present exactly when the lead has been assessed.",
      path: ["score"],
    },
  )
export type ScoreResult = z.infer<typeof scoreResultSchema>

export const followUpDraftSchema = z.object({
  subject: z.string(),
  message: z.string(),
  /** Which evidence items the message drew on, so personalization is checkable. */
  grounded_in: z.array(signalSchema),
  generated_at: z.string().datetime(),
  model: z.string(),
})
export type FollowUpDraft = z.infer<typeof followUpDraftSchema>

export const nextActionSchema = z.object({
  action: nextActionTypeSchema,
  rationale: z.string(),
  /** Suggested time to act, ISO 8601. Null when the action is immediate. */
  due_at: z.string().datetime().nullable(),
  decided_at: z.string().datetime(),
})
export type NextAction = z.infer<typeof nextActionSchema>

/* ------------------------------------------------------------------ *
 * The lead
 * ------------------------------------------------------------------ */

export const contactSchema = z.object({
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  role: z.string().nullable(),
})
export type Contact = z.infer<typeof contactSchema>

export const leadSchema = z.object({
  id: z.string().uuid(),
  source: leadSourceSchema,

  contact: contactSchema,
  company: z.string().nullable(),
  company_size: companySizeSchema.nullable(),
  industry: z.string().nullable(),
  budget: z.string().nullable(),
  need: z.string().nullable(),
  interest_level: interestLevelSchema.nullable(),

  /** Whatever arrived, untouched. Kept so extraction can be re-run and audited. */
  raw_context: z.string(),
  /** Cleaned, deduplicated text the analyst actually reads. */
  normalized_context: z.string(),

  evidence: evidenceSchema.nullable(),
  assessment: scoreResultSchema.nullable(),
  follow_up: followUpDraftSchema.nullable(),
  next_action: nextActionSchema.nullable(),

  /** Human-owned. The system proposes; a person disposes. */
  status: leadStatusSchema,
  owner: z.string().nullable(),
  follow_up_state: followUpStateSchema,

  /** Speed-to-lead clock. */
  first_touch_due_at: z.string().datetime(),
  first_touch_at: z.string().datetime().nullable(),
  sla_state: slaStateSchema,

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})
export type Lead = z.infer<typeof leadSchema>

/** Trimmed shape for table rows — avoids shipping full evidence to a list view. */
export const leadSummarySchema = leadSchema
  .pick({
    id: true,
    source: true,
    company: true,
    industry: true,
    company_size: true,
    status: true,
    owner: true,
    follow_up_state: true,
    first_touch_due_at: true,
    first_touch_at: true,
    sla_state: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    contact_name: z.string().nullable(),
    contact_email: z.string().email().nullable(),
    score: z.number().int().min(0).max(100).nullable(),
    priority: prioritySchema.nullable(),
    qualification_status: qualificationStatusSchema,
  })
export type LeadSummary = z.infer<typeof leadSummarySchema>

/* ------------------------------------------------------------------ *
 * Activity — the audit trail, and the SLA evidence
 * ------------------------------------------------------------------ */

export const ACTIVITY_TYPES = [
  "lead_created",
  "lead_imported",
  "lead_updated",
  "analyzed",
  "scored",
  "follow_up_drafted",
  "follow_up_approved",
  "follow_up_sent",
  "reply_received",
  "next_action_recommended",
  "status_changed",
  "owner_assigned",
  "sla_breached",
  "error",
] as const
export const activityTypeSchema = z.enum(ACTIVITY_TYPES)
export type ActivityType = z.infer<typeof activityTypeSchema>

export const activitySchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  type: activityTypeSchema,
  /** "system", "ai:<stage>", or a user identifier. Never ambiguous. */
  actor: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.string().datetime(),
})
export type Activity = z.infer<typeof activitySchema>

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

/**
 * Lead capture. Every field is optional except the free-text context, because
 * a real website form gives you whatever the visitor felt like typing. The
 * pipeline's job is to cope with that, not to reject it.
 */
export const createLeadSchema = z.object({
  source: leadSourceSchema.default("website"),
  contact: contactSchema.partial().default({}),
  company: z.string().nullable().default(null),
  company_size: companySizeSchema.nullable().default(null),
  industry: z.string().nullable().default(null),
  budget: z.string().nullable().default(null),
  need: z.string().nullable().default(null),
  interest_level: interestLevelSchema.nullable().default(null),
  message: z.string().default(""),
  /** Arbitrary extra form fields, preserved into raw_context. */
  extra: z.record(z.string(), z.string()).default({}),
})
export type CreateLeadInput = z.infer<typeof createLeadSchema>

export const importLeadsSchema = z.object({
  leads: z.array(createLeadSchema).min(1).max(500),
  /** Analyze and score on arrival, or leave for an explicit call. */
  auto_analyze: z.boolean().default(false),
})
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>

export const updateLeadSchema = z
  .object({
    contact: contactSchema.partial(),
    company: z.string().nullable(),
    company_size: companySizeSchema.nullable(),
    industry: z.string().nullable(),
    budget: z.string().nullable(),
    need: z.string().nullable(),
    interest_level: interestLevelSchema.nullable(),
    owner: z.string().nullable(),
  })
  .partial()
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>

export const updateStatusSchema = z.object({
  status: leadStatusSchema,
  /** Why the human moved it. Worth capturing while the reason is fresh. */
  note: z.string().nullable().default(null),
})
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>

export const listLeadsQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  priority: prioritySchema.optional(),
  qualification_status: qualificationStatusSchema.optional(),
  sla_state: slaStateSchema.optional(),
  owner: z.string().optional(),
  q: z.string().optional(),
  sort: z
    .enum(["created_at", "updated_at", "score", "first_touch_due_at"])
    .default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
})
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>

/** Marking a draft as actually sent requires proof, not an assertion. */
export const confirmSendSchema = z.object({
  provider: z.string().min(1),
  provider_message_id: z.string().min(1),
  sent_at: z.string().datetime(),
})
export type ConfirmSendInput = z.infer<typeof confirmSendSchema>

/* ------------------------------------------------------------------ *
 * Responses
 * ------------------------------------------------------------------ */

/**
 * One envelope for every route. The dashboard can branch on `ok` alone and
 * never has to guess whether a 200 body is data or an error description.
 */
export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.object({ ok: z.literal(true), data })
}

export const API_ERROR_CODES = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "provider_unavailable",
  "internal",
] as const
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export const apiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    /** Field-level validation detail, keyed by path. */
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>

export const paginationSchema = z.object({
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
})
export type Pagination = z.infer<typeof paginationSchema>

export const listLeadsResponseSchema = z.object({
  leads: z.array(leadSummarySchema),
  pagination: paginationSchema,
})
export type ListLeadsResponse = z.infer<typeof listLeadsResponseSchema>

/** Powers the dashboard's headline tiles. */
export const pipelineStatsSchema = z.object({
  total: z.number().int(),
  by_priority: z.record(prioritySchema, z.number().int()),
  by_status: z.record(leadStatusSchema, z.number().int()),
  needs_review: z.number().int(),
  sla_breached: z.number().int(),
  awaiting_first_touch: z.number().int(),
  /** Null until at least one lead has been touched — not zero. */
  median_first_touch_minutes: z.number().nullable(),
})
export type PipelineStats = z.infer<typeof pipelineStatsSchema>

export type ApiResponse<T> = { ok: true; data: T } | ApiError
