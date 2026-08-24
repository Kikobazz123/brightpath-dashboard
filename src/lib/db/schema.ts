import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import {
  COMPANY_SIZE_BANDS,
  FOLLOW_UP_STATES,
  INTEREST_LEVELS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PRIORITIES,
  QUALIFICATION_STATUSES,
  SLA_STATES,
  ACTIVITY_TYPES,
  type Evidence,
  type FollowUpDraft,
  type NextAction,
  type ScoreResult,
} from "@/lib/contracts/leads"

/**
 * Database schema for the BrightPath sales assistant.
 *
 * Enum values are imported from the contract rather than retyped, so a change
 * to the contract surfaces here as a type error instead of a silent mismatch
 * between what the API accepts and what the database can store.
 */

export const leadSourceEnum = pgEnum("lead_source", LEAD_SOURCES)
export const companySizeEnum = pgEnum("company_size", COMPANY_SIZE_BANDS)
export const interestLevelEnum = pgEnum("interest_level", INTEREST_LEVELS)
export const priorityEnum = pgEnum("priority", PRIORITIES)
export const qualificationStatusEnum = pgEnum(
  "qualification_status",
  QUALIFICATION_STATUSES,
)
export const leadStatusEnum = pgEnum("lead_status", LEAD_STATUSES)
export const followUpStateEnum = pgEnum("follow_up_state", FOLLOW_UP_STATES)
export const slaStateEnum = pgEnum("sla_state", SLA_STATES)
export const activityTypeEnum = pgEnum("activity_type", ACTIVITY_TYPES)

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Access boundary. Every query filters on this — a lead belongs to exactly
     * one tenant and is never readable across that line.
     */
    tenantId: text("tenant_id").notNull(),

    source: leadSourceEnum("source").notNull().default("website"),

    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    contactRole: text("contact_role"),

    company: text("company"),
    companySize: companySizeEnum("company_size"),
    industry: text("industry"),
    budget: text("budget"),
    need: text("need"),
    interestLevel: interestLevelEnum("interest_level"),

    /** Exactly what arrived. Never edited, so extraction stays re-runnable and auditable. */
    rawContext: text("raw_context").notNull().default(""),
    /** Cleaned text the analyst reads. */
    normalizedContext: text("normalized_context").notNull().default(""),

    /**
     * The three pipeline outputs, stored as typed JSON.
     *
     * They live in separate columns on purpose: evidence is what the lead said,
     * assessment is what the rubric computed, and the follow-up is generated
     * prose. Merging them into one blob would lose the distinction the whole
     * design rests on.
     */
    evidence: jsonb("evidence").$type<Evidence>(),
    assessment: jsonb("assessment").$type<ScoreResult>(),
    followUp: jsonb("follow_up").$type<FollowUpDraft>(),
    nextAction: jsonb("next_action").$type<NextAction>(),

    /**
     * Denormalized from `assessment` so the leads table can sort and filter in
     * SQL without unpacking JSON on every row. Written only by the scoring
     * step, alongside the assessment itself.
     */
    score: integer("score"),
    priority: priorityEnum("priority"),
    qualificationStatus: qualificationStatusEnum("qualification_status")
      .notNull()
      .default("NOT_ASSESSED"),
    confidence: real("confidence"),

    /** Human-owned. No AI stage writes these. */
    status: leadStatusEnum("status").notNull().default("new"),
    owner: text("owner"),

    followUpState: followUpStateEnum("follow_up_state")
      .notNull()
      .default("none"),
    /**
     * Proof of sending. Populated only when a provider confirms delivery —
     * these two columns are what separate "sent" from "we think we sent".
     */
    sentProvider: text("sent_provider"),
    sentProviderMessageId: text("sent_provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),

    /** Speed-to-lead clock. */
    firstTouchDueAt: timestamp("first_touch_due_at", {
      withTimezone: true,
    }).notNull(),
    firstTouchAt: timestamp("first_touch_at", { withTimezone: true }),
    slaState: slaStateEnum("sla_state").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("leads_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("leads_tenant_status_idx").on(t.tenantId, t.status),
    index("leads_tenant_priority_idx").on(t.tenantId, t.priority),
    /** Drives the "who is about to be left waiting" queue. */
    index("leads_tenant_sla_idx").on(t.tenantId, t.slaState, t.firstTouchDueAt),
    index("leads_tenant_owner_idx").on(t.tenantId, t.owner),
  ],
)

/**
 * Append-only. Nothing here is ever updated or deleted — this table is both the
 * audit trail and the evidence behind every SLA number the dashboard reports.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    type: activityTypeEnum("type").notNull(),
    /** "system", "ai:<stage>", or a user id. Deliberately unambiguous. */
    actor: text("actor").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activities_lead_ts_idx").on(t.leadId, t.timestamp),
    index("activities_tenant_ts_idx").on(t.tenantId, t.timestamp),
  ],
)

/**
 * One row per model invocation.
 *
 * Kept separate from the lead so a re-run never overwrites the record of what
 * the previous run produced — that history is what lets you answer "why did
 * this lead score differently last week?" and what makes a bad extraction
 * debuggable rather than merely regrettable.
 */
export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    /** "analyst" | "scoring" | "writer" | "advisor" */
    stage: text("stage").notNull(),
    provider: text("provider"),
    model: text("model"),
    /** Hash of the input, so identical inputs are recognisable across runs. */
    inputReference: text("input_reference"),
    output: jsonb("output").$type<Record<string, unknown>>(),
    confidence: real("confidence"),
    /** "ok" | "failed" | "skipped" */
    status: text("status").notNull().default("ok"),
    errorMessage: text("error_message"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("analysis_runs_lead_idx").on(t.leadId, t.startedAt),
    index("analysis_runs_stage_idx").on(t.tenantId, t.stage),
  ],
)

export type LeadRow = typeof leads.$inferSelect
export type NewLeadRow = typeof leads.$inferInsert
export type ActivityRow = typeof activities.$inferSelect
export type NewActivityRow = typeof activities.$inferInsert
export type AnalysisRunRow = typeof analysisRuns.$inferSelect
export type NewAnalysisRunRow = typeof analysisRuns.$inferInsert
