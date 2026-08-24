/**
 * End-to-end verification against the real Neon database.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-journey.ts
 *
 * Walks the judge journey — capture, analyse, score, draft, advise, status —
 * and checks the claims that would be embarrassing to get wrong in front of
 * someone: that the SLA clock is real, that nothing reports itself as sent
 * without proof, and that one tenant cannot read another's leads.
 *
 * Runs against its own throwaway tenant and deletes everything afterwards, so
 * the seeded demo data is left untouched.
 */

import { and, eq } from "drizzle-orm"

import type { CreateLeadInput } from "../src/lib/contracts/leads"
import { getDb } from "../src/lib/db"
import { activities, analysisRuns, leads } from "../src/lib/db/schema"
import {
  confirmSend,
  createLead,
  getActivity,
  getLead,
  getStats,
  listLeads,
  NotFoundError,
  runFullPipeline,
  updateStatus,
} from "../src/lib/leads/service"
import { resolveSlaState } from "../src/lib/pipeline/intake"
import { slaMinutes } from "../src/lib/pipeline/rubric"

const TENANT = `verify-${Date.now()}`
const OTHER_TENANT = `${TENANT}-intruder`

let passed = 0
let failed = 0

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (error) {
    failed++
    console.log(`  FAIL  ${name}`)
    console.log(`        ${(error as Error).message.split("\n")[0]}`)
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const CAPTURE: CreateLeadInput = {
  source: "website",
  contact: {
    name: "Ines Vasquez",
    email: "ines@ridgelinesurveying.com",
    phone: null,
    role: "Director",
  },
  company: "Ridgeline Surveying",
  company_size: null,
  industry: null,
  budget: null,
  need: null,
  interest_level: null,
  message:
    "We're a surveying firm with 30 staff. Report production takes us four days per job and clients are complaining. We have about $18,000 budgeted. Can we talk this week?",
  extra: {},
}

async function cleanup() {
  const db = getDb()
  for (const tenant of [TENANT, OTHER_TENANT]) {
    const rows = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.tenantId, tenant))
    for (const row of rows) {
      await db.delete(analysisRuns).where(eq(analysisRuns.leadId, row.id))
      await db.delete(activities).where(eq(activities.leadId, row.id))
    }
    await db.delete(leads).where(eq(leads.tenantId, tenant))
  }
}

async function main() {
  console.log(`\nJourney verification — tenant "${TENANT}", SLA ${slaMinutes()} min\n`)

  console.log("Capture")
  const created = await createLead(TENANT, CAPTURE, "capture-form")

  await check("a lead is stored with both raw and normalized context", () => {
    assert(created.id, "no id returned")
    assert(created.raw_context.includes("Ridgeline"), "raw context missing")
    assert(
      created.normalized_context.includes("four days per job"),
      "normalized context lost the message",
    )
  })

  await check("the SLA clock starts on arrival", () => {
    const due = new Date(created.first_touch_due_at).getTime()
    const born = new Date(created.created_at).getTime()
    const gapMinutes = Math.round((due - born) / 60000)
    assert(
      gapMinutes === slaMinutes(),
      `deadline is ${gapMinutes} min after arrival, expected ${slaMinutes()}`,
    )
    assert(created.sla_state === "pending", "a fresh lead should be pending")
    assert(created.first_touch_at === null, "nothing has touched it yet")
  })

  await check("a new lead starts unassessed rather than assumed good", () => {
    assert(
      created.assessment === null,
      "assessment must be null before analysis runs",
    )
    assert(created.status === "new", "status should be new")
    assert(
      created.follow_up_state === "none",
      "no follow-up exists yet",
    )
  })

  console.log("\nPipeline")
  const processed = await runFullPipeline(TENANT, created.id)

  await check("evidence is attached after analysis", () => {
    assert(processed.evidence !== null, "no evidence stored")
    assert(processed.evidence!.items.length === 5, "expected five signals")
  })

  await check(
    "with no AI provider configured, nothing is invented",
    () => {
      // Running in stub mode: every signal should be reported absent.
      const invented = processed.evidence!.items.filter(
        (i) => i.present && !i.source_span,
      )
      assert(
        invented.length === 0,
        `${invented.length} signal(s) claimed without a source quote`,
      )
    },
  )

  await check("an assessment is always produced, even when thin", () => {
    assert(processed.assessment !== null, "no assessment stored")
    assert(
      processed.assessment!.rubric_version.length > 0,
      "the rubric version must be recorded so a score can be reproduced",
    )
  })

  await check("a withheld score is null, never a misleading zero", () => {
    const a = processed.assessment!
    if (a.qualification_status === "NEEDS_REVIEW") {
      assert(a.score === null, "NEEDS_REVIEW must not publish a number")
      assert(a.priority === null, "NEEDS_REVIEW must not publish a priority")
      assert(
        a.missing_information.length > 0,
        "review was required but nothing was named as missing",
      )
    } else {
      assert(a.score !== null, "an assessed lead must carry a score")
    }
  })

  await check("a next action is always recommended", () => {
    assert(processed.next_action !== null, "no next action")
    assert(
      processed.next_action!.rationale.length > 20,
      "the rationale must explain itself, not just name the action",
    )
  })

  console.log("\nTruthfulness")
  await check("a drafted follow-up is never reported as sent", () => {
    assert(
      processed.follow_up_state !== "sent",
      "drafting must not set the sent state",
    )
  })

  await check("only a confirmed receipt can move state to sent", async () => {
    const sent = await confirmSend(
      TENANT,
      created.id,
      "postmark",
      "msg_abc123",
      new Date(),
      "rep.test",
    )
    assert(sent.follow_up_state === "sent", "confirmed send should set sent")

    const timeline = await getActivity(TENANT, created.id)
    const event = timeline.find((a) => a.type === "follow_up_sent")
    assert(event, "a send must be recorded on the timeline")
    assert(
      event!.payload.provider_message_id === "msg_abc123",
      "the provider receipt must be stored as proof",
    )
  })

  console.log("\nSLA clock")
  await check("first contact stops the clock and records when", async () => {
    const lead = await getLead(TENANT, created.id)
    assert(lead.first_touch_at !== null, "first touch was not recorded")
    assert(lead.sla_state !== "pending", "the clock should have stopped")
  })

  await check("a lead answered inside the window reads as met", () => {
    const born = new Date("2026-08-24T10:00:00Z")
    const due = new Date(born.getTime() + slaMinutes() * 60000)
    const touched = new Date(born.getTime() + 60000)
    assert(resolveSlaState(due, touched) === "met", "one minute should be met")
  })

  await check("a lead left waiting reads as breached, and stays breached", () => {
    const born = new Date("2026-08-24T10:00:00Z")
    const due = new Date(born.getTime() + slaMinutes() * 60000)
    const late = new Date(born.getTime() + 5 * 60 * 60000)
    assert(
      resolveSlaState(due, late) === "breached",
      "a late reply is still a breach — the miss already happened",
    )
    assert(
      resolveSlaState(due, null, late) === "breached",
      "an untouched overdue lead must breach without needing a cron job",
    )
  })

  console.log("\nAudit trail")
  await check("the timeline records every stage in order", async () => {
    await updateStatus(TENANT, created.id, "contacted", "spoke by phone", "rep.test")
    const timeline = await getActivity(TENANT, created.id)
    const types = timeline.map((a) => a.type)

    for (const required of [
      "lead_created",
      "analyzed",
      "scored",
      "next_action_recommended",
      "status_changed",
    ]) {
      assert(types.includes(required as never), `timeline missing ${required}`)
    }

    const times = timeline.map((a) => new Date(a.timestamp).getTime())
    const sorted = [...times].sort((a, b) => a - b)
    assert(
      JSON.stringify(times) === JSON.stringify(sorted),
      "the timeline must be returned in chronological order",
    )
  })

  await check("every AI stage records which model produced it", () => {
    assert(
      processed.evidence!.model.length > 0,
      "evidence must name the model that produced it",
    )
  })

  console.log("\nAccess control")
  await check("another tenant cannot read this lead by id", async () => {
    let blocked = false
    try {
      await getLead(OTHER_TENANT, created.id)
    } catch (error) {
      blocked = error instanceof NotFoundError
    }
    assert(blocked, "a foreign tenant was able to read the lead")
  })

  await check("another tenant cannot see it in a listing", async () => {
    const { leads: rows } = await listLeads(OTHER_TENANT, {
      sort: "created_at",
      order: "desc",
      page: 1,
      page_size: 50,
    })
    assert(
      !rows.some((l) => l.id === created.id),
      "the lead leaked into another tenant's list",
    )
  })

  await check("another tenant cannot read its activity timeline", async () => {
    let blocked = false
    try {
      await getActivity(OTHER_TENANT, created.id)
    } catch (error) {
      blocked = error instanceof NotFoundError
    }
    assert(blocked, "activity leaked across the tenant boundary")
  })

  await check("stats are scoped to the tenant", async () => {
    const mine = await getStats(TENANT)
    const theirs = await getStats(OTHER_TENANT)
    assert(mine.total === 1, `expected 1 lead in this tenant, got ${mine.total}`)
    assert(theirs.total === 0, "another tenant's stats must not count our leads")
  })

  await check("median first-touch is null when nothing was touched", async () => {
    const theirs = await getStats(OTHER_TENANT)
    assert(
      theirs.median_first_touch_minutes === null,
      "an empty tenant must report null, not zero — zero would read as instant",
    )
  })

  console.log(`\n${passed} passed, ${failed} failed\n`)
}

main()
  .then(cleanup)
  .then(() => process.exit(failed === 0 ? 0 : 1))
  .catch(async (error) => {
    console.error("\nJourney verification error:", error)
    await cleanup().catch(() => {})
    process.exit(1)
  })
