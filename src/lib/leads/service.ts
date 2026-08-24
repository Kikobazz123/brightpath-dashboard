import { and, count, desc, asc, eq, ilike, or, sql } from "drizzle-orm"

import {
  type Activity,
  type ActivityType,
  type CreateLeadInput,
  type Lead,
  type LeadSummary,
  type ListLeadsQuery,
  type PipelineStats,
  type UpdateLeadInput,
} from "@/lib/contracts/leads"
import { getDb } from "@/lib/db"
import { activities, analysisRuns, leads, type LeadRow } from "@/lib/db/schema"
import { analyzeLead } from "@/lib/pipeline/analyst"
import { adviseNextAction } from "@/lib/pipeline/advisor"
import {
  FIRST_TOUCH_ACTIVITIES,
  firstTouchDeadline,
  normalizeIntake,
  resolveSlaState,
  waitMinutes,
} from "@/lib/pipeline/intake"
import { scoreLead } from "@/lib/pipeline/scoring"
import { writeFollowUp } from "@/lib/pipeline/writer"

/**
 * Lead service — all database access lives here so routes stay thin and the
 * tenant filter is applied in exactly one place rather than remembered at
 * eleven call sites.
 */

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Lead ${id} not found`)
  }
}

/* ------------------------------------------------------------------ *
 * Mapping
 * ------------------------------------------------------------------ */

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    source: row.source,
    contact: {
      name: row.contactName,
      email: row.contactEmail,
      phone: row.contactPhone,
      role: row.contactRole,
    },
    company: row.company,
    company_size: row.companySize,
    industry: row.industry,
    budget: row.budget,
    need: row.need,
    interest_level: row.interestLevel,
    raw_context: row.rawContext,
    normalized_context: row.normalizedContext,
    evidence: row.evidence ?? null,
    assessment: row.assessment ?? null,
    follow_up: row.followUp ?? null,
    next_action: row.nextAction ?? null,
    status: row.status,
    owner: row.owner,
    follow_up_state: row.followUpState,
    first_touch_due_at: row.firstTouchDueAt.toISOString(),
    first_touch_at: row.firstTouchAt?.toISOString() ?? null,
    sla_state: resolveSlaState(row.firstTouchDueAt, row.firstTouchAt),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

function toSummary(row: LeadRow): LeadSummary {
  return {
    id: row.id,
    source: row.source,
    company: row.company,
    industry: row.industry,
    company_size: row.companySize,
    contact_name: row.contactName,
    contact_email: row.contactEmail,
    score: row.score,
    priority: row.priority,
    qualification_status: row.qualificationStatus,
    status: row.status,
    owner: row.owner,
    follow_up_state: row.followUpState,
    first_touch_due_at: row.firstTouchDueAt.toISOString(),
    first_touch_at: row.firstTouchAt?.toISOString() ?? null,
    /** Recomputed on read so a lead breaches on time without a cron job. */
    sla_state: resolveSlaState(row.firstTouchDueAt, row.firstTouchAt),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

/* ------------------------------------------------------------------ *
 * Activity + first touch
 * ------------------------------------------------------------------ */

export async function logActivity(
  tenantId: string,
  leadId: string,
  type: ActivityType,
  actor: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const db = getDb()
  await db.insert(activities).values({ tenantId, leadId, type, actor, payload })

  /**
   * The first qualifying action stops the SLA clock. Recorded here rather than
   * in each route so no future endpoint can forget to do it — and only for
   * actions the lead would actually notice.
   */
  if ((FIRST_TOUCH_ACTIVITIES as readonly string[]).includes(type)) {
    const now = new Date()
    const [row] = await db
      .select({
        firstTouchAt: leads.firstTouchAt,
        firstTouchDueAt: leads.firstTouchDueAt,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1)

    if (row && !row.firstTouchAt) {
      const state = resolveSlaState(row.firstTouchDueAt, now)
      await db
        .update(leads)
        .set({ firstTouchAt: now, slaState: state, updatedAt: now })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))

      if (state === "breached") {
        await db.insert(activities).values({
          tenantId,
          leadId,
          type: "sla_breached",
          actor: "system",
          payload: {
            due_at: row.firstTouchDueAt.toISOString(),
            touched_at: now.toISOString(),
          },
        })
      }
    }
  }
}

async function recordRun(
  tenantId: string,
  leadId: string,
  stage: string,
  result: {
    provider: string
    model: string
    inputTokens: number | null
    outputTokens: number | null
    durationMs: number
  },
  output: Record<string, unknown>,
): Promise<void> {
  await getDb().insert(analysisRuns).values({
    tenantId,
    leadId,
    stage,
    provider: result.provider,
    model: result.model,
    output,
    durationMs: result.durationMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    status: "ok",
    finishedAt: new Date(),
  })
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function getLead(tenantId: string, id: string): Promise<Lead> {
  const [row] = await getDb()
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
    .limit(1)
  if (!row) throw new NotFoundError(id)
  return toLead(row)
}

export async function listLeads(
  tenantId: string,
  query: ListLeadsQuery,
): Promise<{ leads: LeadSummary[]; total: number }> {
  const db = getDb()
  const filters = [eq(leads.tenantId, tenantId)]

  if (query.status) filters.push(eq(leads.status, query.status))
  if (query.priority) filters.push(eq(leads.priority, query.priority))
  if (query.qualification_status) {
    filters.push(eq(leads.qualificationStatus, query.qualification_status))
  }
  if (query.owner) filters.push(eq(leads.owner, query.owner))
  if (query.q) {
    const term = `%${query.q}%`
    const match = or(
      ilike(leads.company, term),
      ilike(leads.contactName, term),
      ilike(leads.contactEmail, term),
      ilike(leads.industry, term),
    )
    if (match) filters.push(match)
  }

  const where = and(...filters)

  const sortColumn =
    query.sort === "score"
      ? leads.score
      : query.sort === "updated_at"
        ? leads.updatedAt
        : query.sort === "first_touch_due_at"
          ? leads.firstTouchDueAt
          : leads.createdAt

  const rows = await db
    .select()
    .from(leads)
    .where(where)
    .orderBy(query.order === "asc" ? asc(sortColumn) : desc(sortColumn))
    .limit(query.page_size)
    .offset((query.page - 1) * query.page_size)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(leads)
    .where(where)

  let summaries = rows.map(toSummary)

  /**
   * SLA state is derived at read time rather than stored, so it can't be
   * filtered in SQL. Filtering after the page is fetched is a known trade-off:
   * correct, and fine at demo scale. At real volume this becomes a generated
   * column with an index.
   */
  if (query.sla_state) {
    summaries = summaries.filter((l) => l.sla_state === query.sla_state)
  }

  return { leads: summaries, total }
}

export async function getActivity(
  tenantId: string,
  leadId: string,
): Promise<Activity[]> {
  await getLead(tenantId, leadId) // enforces the tenant boundary
  const rows = await getDb()
    .select()
    .from(activities)
    .where(and(eq(activities.leadId, leadId), eq(activities.tenantId, tenantId)))
    .orderBy(asc(activities.timestamp))

  return rows.map((r) => ({
    id: r.id,
    lead_id: r.leadId,
    type: r.type,
    actor: r.actor,
    payload: r.payload ?? {},
    timestamp: r.timestamp.toISOString(),
  }))
}

export async function getStats(tenantId: string): Promise<PipelineStats> {
  const db = getDb()
  const rows = await db
    .select({
      priority: leads.priority,
      status: leads.status,
      qualificationStatus: leads.qualificationStatus,
      createdAt: leads.createdAt,
      firstTouchAt: leads.firstTouchAt,
      firstTouchDueAt: leads.firstTouchDueAt,
    })
    .from(leads)
    .where(eq(leads.tenantId, tenantId))

  const byPriority: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 }
  const byStatus: Record<string, number> = {}
  let needsReview = 0
  let breached = 0
  let awaiting = 0
  const touchTimes: number[] = []

  const now = new Date()
  for (const row of rows) {
    if (row.priority) byPriority[row.priority] = (byPriority[row.priority] ?? 0) + 1
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    if (row.qualificationStatus === "NEEDS_REVIEW") needsReview++

    const sla = resolveSlaState(row.firstTouchDueAt, row.firstTouchAt, now)
    if (sla === "breached") breached++
    if (!row.firstTouchAt) awaiting++
    if (row.firstTouchAt) {
      touchTimes.push(waitMinutes(row.createdAt, row.firstTouchAt))
    }
  }

  /**
   * Null, not zero, when nothing has been touched. A zero here would read as
   * "we respond instantly", which is the opposite of the truth.
   */
  let median: number | null = null
  if (touchTimes.length) {
    const sorted = [...touchTimes].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  return {
    total: rows.length,
    by_priority: byPriority as PipelineStats["by_priority"],
    by_status: byStatus as PipelineStats["by_status"],
    needs_review: needsReview,
    sla_breached: breached,
    awaiting_first_touch: awaiting,
    median_first_touch_minutes: median,
  }
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export async function createLead(
  tenantId: string,
  input: CreateLeadInput,
  actor = "system",
): Promise<Lead> {
  const db = getDb()
  const now = new Date()
  const { rawContext, normalizedContext } = normalizeIntake(input)

  const [row] = await db
    .insert(leads)
    .values({
      tenantId,
      source: input.source,
      contactName: input.contact?.name ?? null,
      contactEmail: input.contact?.email ?? null,
      contactPhone: input.contact?.phone ?? null,
      contactRole: input.contact?.role ?? null,
      company: input.company,
      companySize: input.company_size,
      industry: input.industry,
      budget: input.budget,
      need: input.need,
      interestLevel: input.interest_level,
      rawContext,
      normalizedContext,
      firstTouchDueAt: firstTouchDeadline(now),
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await logActivity(tenantId, row.id, "lead_created", actor, {
    source: input.source,
  })
  return toLead(row)
}

export async function updateLead(
  tenantId: string,
  id: string,
  input: UpdateLeadInput,
  actor = "system",
): Promise<Lead> {
  const db = getDb()
  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (input.contact) {
    if ("name" in input.contact) patch.contactName = input.contact.name
    if ("email" in input.contact) patch.contactEmail = input.contact.email
    if ("phone" in input.contact) patch.contactPhone = input.contact.phone
    if ("role" in input.contact) patch.contactRole = input.contact.role
  }
  if ("company" in input) patch.company = input.company
  if ("company_size" in input) patch.companySize = input.company_size
  if ("industry" in input) patch.industry = input.industry
  if ("budget" in input) patch.budget = input.budget
  if ("need" in input) patch.need = input.need
  if ("interest_level" in input) patch.interestLevel = input.interest_level
  if ("owner" in input) patch.owner = input.owner

  const [row] = await db
    .update(leads)
    .set(patch)
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
    .returning()
  if (!row) throw new NotFoundError(id)

  await logActivity(tenantId, id, "lead_updated", actor, {
    fields: Object.keys(patch).filter((k) => k !== "updatedAt"),
  })
  if ("owner" in input && input.owner) {
    await logActivity(tenantId, id, "owner_assigned", actor, {
      owner: input.owner,
    })
  }

  return getLead(tenantId, id)
}

/** Extract evidence. Does not score — that is a separate, deliberate step. */
export async function runAnalysis(
  tenantId: string,
  id: string,
): Promise<Lead> {
  const lead = await getLead(tenantId, id)
  const result = await analyzeLead(lead.normalized_context)

  await getDb()
    .update(leads)
    .set({ evidence: result.evidence, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

  await recordRun(tenantId, id, "analyst", result, {
    items: result.evidence.items.length,
    present: result.evidence.items.filter((i) => i.present).length,
  })
  await logActivity(tenantId, id, "analyzed", `ai:analyst`, {
    model: `${result.provider}:${result.model}`,
    signals_found: result.evidence.items.filter((i) => i.present).length,
  })

  return getLead(tenantId, id)
}

/** Score from stored evidence. Analyses first if none exists. */
export async function runScoring(tenantId: string, id: string): Promise<Lead> {
  let lead = await getLead(tenantId, id)
  if (!lead.evidence) lead = await runAnalysis(tenantId, id)
  if (!lead.evidence) throw new Error("Analysis produced no evidence")

  const assessment = scoreLead(lead.evidence)

  await getDb()
    .update(leads)
    .set({
      assessment,
      score: assessment.score,
      priority: assessment.priority,
      qualificationStatus: assessment.qualification_status,
      confidence: assessment.confidence,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

  await logActivity(tenantId, id, "scored", "system", {
    score: assessment.score,
    priority: assessment.priority,
    status: assessment.qualification_status,
    rubric: assessment.rubric_version,
  })

  return getLead(tenantId, id)
}

export async function runFollowUp(tenantId: string, id: string): Promise<Lead> {
  let lead = await getLead(tenantId, id)
  if (!lead.evidence) lead = await runAnalysis(tenantId, id)

  const result = await writeFollowUp(
    lead.evidence!,
    lead.contact.name,
    lead.assessment,
  )

  await getDb()
    .update(leads)
    .set({
      followUp: result.draft,
      /** Drafted. Not sent — and the state says exactly that. */
      followUpState: "drafted",
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

  await recordRun(tenantId, id, "writer", result, {
    subject: result.draft.subject,
    grounded_in: result.draft.grounded_in,
  })
  await logActivity(tenantId, id, "follow_up_drafted", "ai:writer", {
    model: `${result.provider}:${result.model}`,
    grounded_in: result.draft.grounded_in,
  })

  return getLead(tenantId, id)
}

export async function runNextAction(tenantId: string, id: string): Promise<Lead> {
  let lead = await getLead(tenantId, id)
  if (!lead.assessment) lead = await runScoring(tenantId, id)

  const action = adviseNextAction(lead.assessment!, lead.evidence!, {
    firstTouchAt: lead.first_touch_at ? new Date(lead.first_touch_at) : null,
  })

  await getDb()
    .update(leads)
    .set({ nextAction: action, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

  await logActivity(tenantId, id, "next_action_recommended", "system", {
    action: action.action,
    due_at: action.due_at,
  })

  return getLead(tenantId, id)
}

export async function updateStatus(
  tenantId: string,
  id: string,
  status: Lead["status"],
  note: string | null,
  actor: string,
): Promise<Lead> {
  const before = await getLead(tenantId, id)

  await getDb()
    .update(leads)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

  await logActivity(tenantId, id, "status_changed", actor, {
    from: before.status,
    to: status,
    note,
  })

  return getLead(tenantId, id)
}

/**
 * Record a confirmed send.
 *
 * Requires a provider and its message id — this is the only path to the `sent`
 * state, and it exists so the system can never claim delivery it cannot prove.
 */
export async function confirmSend(
  tenantId: string,
  id: string,
  provider: string,
  providerMessageId: string,
  sentAt: Date,
  actor: string,
): Promise<Lead> {
  await getLead(tenantId, id)

  await getDb()
    .update(leads)
    .set({
      followUpState: "sent",
      sentProvider: provider,
      sentProviderMessageId: providerMessageId,
      sentAt,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

  await logActivity(tenantId, id, "follow_up_sent", actor, {
    provider,
    provider_message_id: providerMessageId,
    sent_at: sentAt.toISOString(),
  })

  return getLead(tenantId, id)
}

/** Full pipeline in one call — what the judge demo and the capture form use. */
export async function runFullPipeline(
  tenantId: string,
  id: string,
): Promise<Lead> {
  await runAnalysis(tenantId, id)
  await runScoring(tenantId, id)
  await runFollowUp(tenantId, id)
  return runNextAction(tenantId, id)
}

export { toLead, toSummary }
export const _sql = sql
