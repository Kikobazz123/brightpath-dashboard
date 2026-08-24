/**
 * Seed the demo pipeline.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed.ts
 *
 * A deliberate choice worth understanding: the evidence for each seed lead is
 * hand-authored here, not generated. Two reasons.
 *
 * First, honesty. Evidence carries a `model` field, and these are stamped
 * "seed-fixture" so nothing in the demo passes hand-written data off as model
 * output. The follow-up drafts are marked the same way.
 *
 * Second, determinism. Scoring, prioritisation, SLA state and next-action
 * advice all run for real against this evidence — those are the parts being
 * demonstrated, and they behave identically on every machine, with no API key
 * and no network. The demo cannot fail live because a provider rate-limited.
 *
 * Every source_span below is quoted verbatim from that lead's own message, so
 * the provenance display has something real to show.
 */

import { and, eq } from "drizzle-orm"

import type {
  Evidence,
  EvidenceItem,
  FollowUpDraft,
  LeadSource,
  Signal,
} from "../src/lib/contracts/leads"
import { getDb } from "../src/lib/db"
import { activities, analysisRuns, leads } from "../src/lib/db/schema"
import { adviseNextAction } from "../src/lib/pipeline/advisor"
import { normalizeIntake, resolveSlaState } from "../src/lib/pipeline/intake"
import { scoreLead } from "../src/lib/pipeline/scoring"
import { slaMinutes } from "../src/lib/pipeline/rubric"

const TENANT = process.env.DEMO_TENANT_ID?.trim() || "brightpath"
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

interface Seed {
  label: string
  source: LeadSource
  name: string
  email: string
  role: string
  company: string
  message: string
  /** [signal, value|null, sourceSpan|null, confidence] */
  facts: Array<[Signal, string | null, string | null, number]>
  followUp?: { subject: string; message: string; grounded: Signal[] }
  /** Hours before now that the lead arrived. Drives the SLA clock. */
  ageHours: number
  /** Hours after arrival that a rep responded, if they did. */
  touchedAfterHours?: number
  owner?: string
}

const SEEDS: Seed[] = [
  {
    label: "HIGH — urgent, funded, in-sector",
    source: "website",
    name: "Amara Okafor",
    email: "a.okafor@meridianaccounting.co.uk",
    role: "Operations Director",
    company: "Meridian Accounting",
    message:
      "We're an accounting practice with about 80 staff. Our client onboarding is completely manual and it's taking us nine days per client, which is costing us work — we lost two clients last quarter over it. We need something in place before our January filing season. We've set aside around $30,000 for this. Can someone call me this week?",
    facts: [
      ["company_fit", "50-249", "about 80 staff", 0.95],
      ["industry_fit", "accounting", "We're an accounting practice", 0.98],
      [
        "need",
        "explicit_urgent",
        "client onboarding is completely manual and it's taking us nine days per client",
        0.95,
      ],
      ["budget", "30000", "We've set aside around $30,000 for this", 0.95],
      ["interest", "high", "Can someone call me this week?", 0.95],
    ],
    followUp: {
      subject: "Nine days to onboard a client — where that time actually goes",
      message:
        "Hi Amara,\n\nNine days per client onboarding, and two clients lost over it last quarter — that is a costly bottleneck, and January filing season makes the timing tight.\n\nFor accounting practices around your size, the delay usually sits in document collection and approval hand-offs rather than the work itself. That part is fixable well before January.\n\nYou asked for a call this week. Does Thursday or Friday morning suit? Thirty minutes is enough to map where the nine days go and tell you honestly what is worth automating.\n\nThe BrightPath Team",
      grounded: ["company_fit", "industry_fit", "need", "interest"],
    },
    ageHours: 0.1,
  },
  {
    label: "HIGH — breached SLA, still waiting (the case study's failure)",
    source: "referral",
    name: "Daniel Whitfield",
    email: "dwhitfield@northgatelogistics.com",
    role: "Managing Director",
    company: "Northgate Logistics",
    message:
      "Referred by Priya at Lockwood. We run a logistics firm, 35 people. Our dispatch scheduling is done on spreadsheets and we're making errors that cost us about £4k a month in re-deliveries. Budget is roughly $25,000. I'd like to get moving quickly — can we set up a call?",
    facts: [
      ["company_fit", "10-49", "35 people", 0.95],
      ["industry_fit", "logistics", "We run a logistics firm", 0.97],
      [
        "need",
        "explicit_urgent",
        "dispatch scheduling is done on spreadsheets and we're making errors that cost us about £4k a month",
        0.93,
      ],
      ["budget", "25000", "Budget is roughly $25,000", 0.94],
      ["interest", "high", "can we set up a call?", 0.95],
    ],
    followUp: {
      subject: "£4k a month in re-deliveries — the spreadsheet is the cause",
      message:
        "Hi Daniel,\n\nThanks for the referral from Priya.\n\nSpreadsheet dispatch scheduling at 35 people is right at the point where manual coordination stops holding, and £4k a month in re-deliveries is the usual symptom. It is also one of the more tractable problems we see.\n\nYou mentioned wanting to move quickly. Are you free for a short call in the next couple of days?\n\nThe BrightPath Team",
      grounded: ["company_fit", "industry_fit", "need", "interest"],
    },
    /** Arrived three hours ago, nobody responded. Exactly the case-study failure. */
    ageHours: 3,
  },
  {
    label: "HIGH — responded inside the window (SLA met)",
    source: "event",
    name: "Sofia Herrera",
    email: "s.herrera@brightlinelegal.com",
    role: "Practice Manager",
    company: "Brightline Legal",
    message:
      "Met your team at the SMB Growth Expo. We're a legal practice with 120 staff. Matter intake is eating our paralegals alive — roughly 15 hours a week each on data entry. We have approval for $40,000 this financial year. Please send over a proposal and let's book time.",
    facts: [
      ["company_fit", "50-249", "a legal practice with 120 staff", 0.96],
      ["industry_fit", "legal", "We're a legal practice", 0.97],
      [
        "need",
        "explicit_urgent",
        "Matter intake is eating our paralegals alive — roughly 15 hours a week each on data entry",
        0.94,
      ],
      ["budget", "40000", "We have approval for $40,000 this financial year", 0.96],
      ["interest", "high", "Please send over a proposal and let's book time", 0.95],
    ],
    followUp: {
      subject: "15 hours a week per paralegal on matter intake",
      message:
        "Hi Sofia,\n\nGood to meet at the Growth Expo.\n\nFifteen hours a week per paralegal on intake data entry is the kind of number that compounds quietly — across a team your size it is most of a full-time role spent retyping.\n\nProposal to follow. Before I send it, one question: is intake the priority, or is it the downstream matter setup that hurts more? The answer changes what I would recommend.\n\nThe BrightPath Team",
      grounded: ["company_fit", "industry_fit", "need", "interest"],
    },
    ageHours: 26,
    touchedAfterHours: 0.15,
    owner: "rep.jordan",
  },
  {
    label: "HIGH — good fit, modest budget, responded in time",
    source: "advertising",
    name: "Tom Bekker",
    email: "tom@havenretailgroup.com",
    role: "Head of Operations",
    company: "Haven Retail Group",
    message:
      "Saw your ad. We're a retail group, around 400 employees across 12 stores. Stock reconciliation between stores is a recurring headache. We'd have maybe $12,000 to spend. Interested to hear what's possible.",
    facts: [
      ["company_fit", "250-999", "around 400 employees across 12 stores", 0.92],
      ["industry_fit", "retail", "We're a retail group", 0.95],
      [
        "need",
        "explicit",
        "Stock reconciliation between stores is a recurring headache",
        0.85,
      ],
      ["budget", "12000", "We'd have maybe $12,000 to spend", 0.85],
      ["interest", "medium", "Interested to hear what's possible", 0.8],
    ],
    followUp: {
      subject: "Stock reconciliation across 12 stores",
      message:
        "Hi Tom,\n\nReconciliation across twelve locations is usually less about the counting and more about the lag between when stock moves and when the system hears about it.\n\nHappy to walk you through what we have done for retail groups at a similar spread, and to be straight with you about what $12,000 does and does not cover.\n\nWould a short call next week work?\n\nThe BrightPath Team",
      grounded: ["company_fit", "industry_fit", "need"],
    },
    ageHours: 8,
    touchedAfterHours: 0.2,
    owner: "rep.casey",
  },
  {
    label: "MEDIUM — gated down: strong numbers, no stated problem",
    source: "social",
    name: "Grace Adeyemi",
    email: "grace@keystonebuild.ng",
    role: "Founder",
    company: "Keystone Build",
    message:
      "Found you on LinkedIn. Construction firm, 22 staff. We know we're behind on tech and want to fix that. Budget around $15,000. When can we talk?",
    facts: [
      ["company_fit", "10-49", "22 staff", 0.94],
      ["industry_fit", "construction", "Construction firm", 0.95],
      ["need", "implied", "We know we're behind on tech and want to fix that", 0.7],
      ["budget", "15000", "Budget around $15,000", 0.88],
      ["interest", "high", "When can we talk?", 0.92],
    ],
    followUp: {
      subject: "Where to start with 22 staff",
      message:
        "Hi Grace,\n\n\"Behind on tech\" covers a lot of ground, and the honest answer is that the right starting point depends on which part of the week costs you most.\n\nFor construction firms around 22 people it is usually either job costing or site reporting. If you can tell me which of those sounds more familiar, I can come to the call with something specific rather than a generic pitch.\n\nWhen suits you this week?\n\nThe BrightPath Team",
      grounded: ["company_fit", "industry_fit", "interest"],
    },
    ageHours: 0.25,
  },
  {
    label: "LOW — enterprise, out of sector, browsing",
    source: "website",
    name: "Richard Vance",
    email: "r.vance@atlasdeepwater.com",
    role: "Analyst",
    company: "Atlas Deepwater",
    message:
      "Doing some market research on automation vendors. We're an offshore drilling operator, about 4,000 employees. No specific project yet, just gathering information. Small discretionary budget, maybe $2,000.",
    facts: [
      ["company_fit", "1000+", "about 4,000 employees", 0.95],
      ["industry_fit", "offshore drilling", "We're an offshore drilling operator", 0.9],
      ["need", "implied", "No specific project yet, just gathering information", 0.75],
      ["budget", "2000", "Small discretionary budget, maybe $2,000", 0.85],
      ["interest", "low", "Doing some market research on automation vendors", 0.9],
    ],
    ageHours: 30,
  },
  {
    label: "NEEDS_REVIEW — budget never mentioned",
    source: "website",
    name: "Lena Ferraro",
    email: "lena.ferraro@corvusinsure.com",
    role: "Claims Manager",
    company: "Corvus Insurance",
    message:
      "We're an insurance brokerage, about 60 people. Claims triage is slow and our team is drowning in email. Would like to understand your approach.",
    facts: [
      ["company_fit", "50-249", "about 60 people", 0.93],
      ["industry_fit", "insurance", "We're an insurance brokerage", 0.95],
      [
        "need",
        "explicit",
        "Claims triage is slow and our team is drowning in email",
        0.88,
      ],
      ["budget", null, null, 0],
      ["interest", "medium", "Would like to understand your approach", 0.8],
    ],
    ageHours: 0.2,
  },
  {
    label: "NEEDS_REVIEW — no problem described",
    source: "referral",
    name: "Marcus Lin",
    email: "m.lin@parkviewdental.com",
    role: "Owner",
    company: "Parkview Dental",
    message:
      "A colleague suggested I get in touch. We're a dental practice with 14 staff. Can we have a chat about what you do? We'd have somewhere around $8,000 available.",
    facts: [
      ["company_fit", "10-49", "a dental practice with 14 staff", 0.93],
      ["industry_fit", "healthcare", "We're a dental practice", 0.85],
      ["need", null, null, 0],
      ["budget", "8000", "We'd have somewhere around $8,000 available", 0.85],
      ["interest", "high", "Can we have a chat about what you do?", 0.88],
    ],
    ageHours: 0.1,
  },
  {
    label: "DISQUALIFY — states outright there is no budget",
    source: "website",
    name: "Priya Raman",
    email: "priya@sunfieldcoop.org",
    role: "Volunteer Coordinator",
    company: "Sunfield Co-op",
    message:
      "We're a small community co-op, 8 volunteers. Our scheduling is chaotic and we'd love help, but we have no budget at all for software this year. Is there anything free?",
    facts: [
      ["company_fit", "1-9", "8 volunteers", 0.9],
      ["industry_fit", "non-profit", "We're a small community co-op", 0.85],
      ["need", "explicit", "Our scheduling is chaotic and we'd love help", 0.85],
      ["budget", "no_budget", "we have no budget at all for software this year", 0.97],
      ["interest", "medium", "Is there anything free?", 0.8],
    ],
    ageHours: 12,
  },
]

function buildEvidence(seed: Seed): Evidence {
  const items: EvidenceItem[] = seed.facts.map(
    ([signal, value, span, confidence]) => ({
      signal,
      present: value !== null,
      value,
      source_span: span,
      confidence,
      note: null,
    }),
  )
  return {
    items,
    context_notes: [],
    extracted_at: new Date().toISOString(),
    model: "seed-fixture",
  }
}

async function main() {
  const db = getDb()
  const now = Date.now()

  console.log(`\nSeeding tenant "${TENANT}" (SLA ${slaMinutes()} min)\n`)

  // Clear prior seed data so the script is safely re-runnable.
  const existing = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.tenantId, TENANT))
  for (const row of existing) {
    await db.delete(analysisRuns).where(eq(analysisRuns.leadId, row.id))
    await db.delete(activities).where(eq(activities.leadId, row.id))
  }
  await db.delete(leads).where(eq(leads.tenantId, TENANT))
  if (existing.length) console.log(`Cleared ${existing.length} existing lead(s).\n`)

  for (const seed of SEEDS) {
    const createdAt = new Date(now - seed.ageHours * HOUR)
    const dueAt = new Date(createdAt.getTime() + slaMinutes() * MINUTE)
    const firstTouchAt =
      seed.touchedAfterHours !== undefined
        ? new Date(createdAt.getTime() + seed.touchedAfterHours * HOUR)
        : null

    const { rawContext, normalizedContext } = normalizeIntake({
      source: seed.source,
      contact: {
        name: seed.name,
        email: seed.email,
        phone: null,
        role: seed.role,
      },
      company: seed.company,
      company_size: null,
      industry: null,
      budget: null,
      need: null,
      interest_level: null,
      message: seed.message,
      extra: {},
    })

    const evidence = buildEvidence(seed)
    const assessment = scoreLead(evidence)
    const nextAction = adviseNextAction(assessment, evidence, { firstTouchAt })
    const slaState = resolveSlaState(dueAt, firstTouchAt, new Date(now))

    const followUp: FollowUpDraft | null = seed.followUp
      ? {
          subject: seed.followUp.subject,
          message: seed.followUp.message,
          grounded_in: seed.followUp.grounded,
          generated_at: createdAt.toISOString(),
          model: "seed-fixture",
        }
      : null

    const [row] = await db
      .insert(leads)
      .values({
        tenantId: TENANT,
        source: seed.source,
        contactName: seed.name,
        contactEmail: seed.email,
        contactRole: seed.role,
        company: seed.company,
        rawContext,
        normalizedContext,
        evidence,
        assessment,
        followUp,
        nextAction,
        score: assessment.score,
        priority: assessment.priority,
        qualificationStatus: assessment.qualification_status,
        confidence: assessment.confidence,
        followUpState: followUp ? "drafted" : "none",
        status: firstTouchAt ? "contacted" : "new",
        owner: seed.owner ?? null,
        firstTouchDueAt: dueAt,
        firstTouchAt,
        slaState,
        createdAt,
        updatedAt: createdAt,
      })
      .returning()

    // Build the timeline in the order it would really have happened.
    const events: Array<[string, string, Record<string, unknown>, Date]> = [
      ["lead_created", "capture-form", { source: seed.source }, createdAt],
      [
        "analyzed",
        "ai:analyst",
        { signals_found: evidence.items.filter((i) => i.present).length },
        new Date(createdAt.getTime() + 4000),
      ],
      [
        "scored",
        "system",
        {
          score: assessment.score,
          priority: assessment.priority,
          status: assessment.qualification_status,
        },
        new Date(createdAt.getTime() + 6000),
      ],
      [
        "next_action_recommended",
        "system",
        { action: nextAction.action },
        new Date(createdAt.getTime() + 7000),
      ],
    ]
    if (followUp) {
      events.push([
        "follow_up_drafted",
        "ai:writer",
        { subject: followUp.subject },
        new Date(createdAt.getTime() + 9000),
      ])
    }
    if (firstTouchAt) {
      events.push([
        "status_changed",
        seed.owner ?? "rep",
        { from: "new", to: "contacted" },
        firstTouchAt,
      ])
    }
    if (slaState === "breached") {
      events.push([
        "sla_breached",
        "system",
        { due_at: dueAt.toISOString() },
        new Date(dueAt.getTime() + 1000),
      ])
    }

    for (const [type, actor, payload, timestamp] of events) {
      await db.insert(activities).values({
        tenantId: TENANT,
        leadId: row.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: type as any,
        actor,
        payload,
        timestamp,
      })
    }

    const scoreLabel =
      assessment.score === null
        ? "  —  NEEDS_REVIEW"
        : `${String(assessment.score).padStart(3)}  ${assessment.priority}`
    console.log(
      `  ${scoreLabel.padEnd(20)} ${slaState.padEnd(9)} ${nextAction.action.padEnd(21)} ${seed.company}`,
    )
  }

  console.log(`\n${SEEDS.length} leads seeded.\n`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed:", error)
    process.exit(1)
  })
