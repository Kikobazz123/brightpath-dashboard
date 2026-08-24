/**
 * Verification for the scoring rubric.
 *
 * Run: npx tsx scripts/verify-scoring.ts
 *
 * No database, no network, no API key — the rubric is a pure function and this
 * proves it. These are the claims a judge is most entitled to be sceptical of,
 * so they are checked rather than asserted in a README.
 */

import assert from "node:assert/strict"

import {
  evidenceSchema,
  scoreResultSchema,
  type Evidence,
  type EvidenceItem,
  type Signal,
} from "../src/lib/contracts/leads"
import { scoreLead } from "../src/lib/pipeline/scoring"
import { RUBRIC_VERSION, WEIGHTS } from "../src/lib/pipeline/rubric"

let passed = 0
let failed = 0

function check(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (error) {
    failed++
    console.log(`  FAIL  ${name}`)
    console.log(`        ${(error as Error).message.split("\n")[0]}`)
  }
}

function item(
  signal: Signal,
  value: string | null,
  confidence = 0.9,
  span = "quoted from the lead",
): EvidenceItem {
  const present = value !== null
  return {
    signal,
    present,
    value,
    source_span: present ? span : null,
    confidence: present ? confidence : 0,
    note: null,
  }
}

function evidence(items: EvidenceItem[]): Evidence {
  return {
    items,
    context_notes: [],
    extracted_at: new Date("2026-08-23T10:00:00Z").toISOString(),
    model: "test-fixture",
  }
}

const strongLead = evidence([
  item("company_fit", "50-249"),
  item("industry_fit", "professional services"),
  item("need", "explicit_urgent"),
  item("budget", "30000"),
  item("interest", "high"),
])

const weakLead = evidence([
  item("company_fit", "1000+"),
  item("industry_fit", "deep sea mining"),
  item("need", "implied"),
  item("budget", "2000"),
  item("interest", "low"),
])

const missingBudget = evidence([
  item("company_fit", "50-249"),
  item("industry_fit", "accounting"),
  item("need", "explicit"),
  item("budget", null),
  item("interest", "high"),
])

console.log("\nRubric weights total 100")
check("weights sum to exactly 100", () => {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
  assert.equal(total, 100, `weights total ${total}, not 100`)
})

console.log("\nDeterminism — the core claim")
check("identical evidence scores identically across 200 runs", () => {
  const first = scoreLead(strongLead, { now: new Date("2026-08-23T12:00:00Z") })
  for (let i = 0; i < 200; i++) {
    const again = scoreLead(strongLead, {
      now: new Date("2026-08-23T12:00:00Z"),
    })
    assert.deepEqual(again, first, `run ${i} diverged`)
  }
})

check("score is independent of evidence ordering", () => {
  const reversed = evidence([...strongLead.items].reverse())
  const a = scoreLead(strongLead, { now: new Date("2026-08-23T12:00:00Z") })
  const b = scoreLead(reversed, { now: new Date("2026-08-23T12:00:00Z") })
  assert.equal(a.score, b.score)
  assert.equal(a.priority, b.priority)
})

console.log("\nKnown fixtures land where the rubric says they should")
check("strong lead scores 100 and is HIGH / QUALIFIED", () => {
  const r = scoreLead(strongLead)
  // 20 company + 15 industry + 25 need + 20 budget + 20 interest
  assert.equal(r.score, 100)
  assert.equal(r.priority, "HIGH")
  assert.equal(r.qualification_status, "QUALIFIED")
})

check("weak lead scores low and is LOW / NOT_QUALIFIED", () => {
  const r = scoreLead(weakLead)
  // 5 company + 2 industry + 10 need + 5 budget + 4 interest = 26
  assert.equal(r.score, 26)
  assert.equal(r.priority, "LOW")
  assert.equal(r.qualification_status, "NOT_QUALIFIED")
})

check("every awarded point traces to a named rubric line", () => {
  const r = scoreLead(strongLead)
  assert.ok(r.reasons.length === 5, "one reason per signal")
  const summed = r.reasons.reduce((s, x) => s + x.points_awarded, 0)
  assert.equal(summed, r.score, "reasons must add up to the published score")
  for (const reason of r.reasons) {
    assert.ok(reason.explanation.length > 0, `${reason.signal} has no explanation`)
    assert.ok(
      reason.points_awarded <= reason.points_possible,
      `${reason.signal} awarded more than possible`,
    )
  }
})

console.log("\nMissing evidence is surfaced, never guessed")
check("absent required signal forces NEEDS_REVIEW with no score", () => {
  const r = scoreLead(missingBudget)
  assert.equal(r.qualification_status, "NEEDS_REVIEW")
  assert.equal(r.score, null, "a withheld score must be null, not zero")
  assert.equal(r.priority, null)
  assert.ok(
    r.missing_information.includes("budget"),
    "the missing signal must be named",
  )
})

check("NEEDS_REVIEW still explains what it did see", () => {
  const r = scoreLead(missingBudget)
  const need = r.reasons.find((x) => x.signal === "need")
  assert.ok(need, "reasons are still returned when review is required")
  assert.ok(need!.points_awarded > 0)
})

check("low confidence alone forces review even with full coverage", () => {
  const hedged = evidence([
    item("company_fit", "50-249", 0.2),
    item("industry_fit", "accounting", 0.2),
    item("need", "explicit", 0.2),
    item("budget", "30000", 0.2),
    item("interest", "high", 0.2),
  ])
  const r = scoreLead(hedged)
  assert.equal(r.qualification_status, "NEEDS_REVIEW")
  assert.equal(r.score, null)
})

check("an unreadable budget counts as missing, not as zero-and-scored", () => {
  const vague = evidence([
    item("company_fit", "50-249"),
    item("industry_fit", "accounting"),
    item("need", "explicit"),
    item("budget", "we'll see how it goes"),
    item("interest", "high"),
  ])
  const r = scoreLead(vague)
  const budget = r.reasons.find((x) => x.signal === "budget")!
  assert.equal(budget.points_awarded, 0)
  assert.match(budget.explanation, /could not be read/i)
})

console.log("\nGates — facts a weighted total must not be able to outvote")
check("an explicit 'no budget' disqualifies despite a decent total", () => {
  const noBudget = evidence([
    item("company_fit", "10-49"),
    item("industry_fit", "non-profit"),
    item("need", "explicit"),
    item("budget", "no_budget", 0.97),
    item("interest", "medium"),
  ])
  const r = scoreLead(noBudget)
  assert.ok(r.score !== null && r.score >= 40, "the raw total is still respectable")
  assert.equal(
    r.qualification_status,
    "NOT_QUALIFIED",
    "but no budget ends qualification",
  )
  assert.equal(r.priority, "LOW")
  assert.ok(
    r.reasons.some((x) => x.explanation.startsWith("Gate:")),
    "the gate must explain itself in the reasons",
  )
})

check("the score is preserved when a gate fires, not silently zeroed", () => {
  const noBudget = evidence([
    item("company_fit", "10-49"),
    item("industry_fit", "non-profit"),
    item("need", "explicit"),
    item("budget", "no_budget", 0.97),
    item("interest", "medium"),
  ])
  const r = scoreLead(noBudget)
  // 20 company + 8 adjacent + 20 need + 0 budget + 12 interest = 60
  assert.equal(r.score, 60, "the reasoning stays visible to the rep")
})

check("a vague need caps priority at MEDIUM however high the total", () => {
  const vagueNeed = evidence([
    item("company_fit", "10-49"),
    item("industry_fit", "construction"),
    item("need", "implied"),
    item("budget", "15000"),
    item("interest", "high"),
  ])
  const r = scoreLead(vagueNeed)
  // 20 + 15 + 10 + 16 + 20 = 81, which would otherwise be HIGH
  assert.equal(r.score, 81)
  assert.equal(r.priority, "MEDIUM", "no stated problem means no top priority")
  assert.equal(r.qualification_status, "QUALIFIED")
})

check("an explicit need still reaches HIGH", () => {
  const r = scoreLead(strongLead)
  assert.equal(r.priority, "HIGH", "the gate must not block genuine HIGH leads")
})

console.log("\nContract enforcement — fabrication is a type error")
check("evidence claiming a value while marked absent is rejected", () => {
  const fabricated = {
    signal: "budget",
    present: false,
    value: "$50,000",
    source_span: null,
    confidence: 0.9,
    note: null,
  }
  const result = evidenceSchema.safeParse({
    items: [fabricated],
    context_notes: [],
    extracted_at: new Date().toISOString(),
    model: "test",
  })
  assert.equal(result.success, false, "schema must reject an invented value")
})

check("evidence claiming presence without a source span is rejected", () => {
  const unsourced = {
    signal: "need",
    present: true,
    value: "explicit",
    source_span: null,
    confidence: 0.9,
    note: null,
  }
  const result = evidenceSchema.safeParse({
    items: [unsourced],
    context_notes: [],
    extracted_at: new Date().toISOString(),
    model: "test",
  })
  assert.equal(result.success, false, "every claim must cite its source text")
})

check("a scored result with a null score is rejected by the contract", () => {
  const inconsistent = {
    rubric_version: RUBRIC_VERSION,
    score: null,
    priority: null,
    qualification_status: "QUALIFIED",
    confidence: 0.9,
    reasons: [],
    missing_information: [],
    scored_at: new Date().toISOString(),
  }
  const result = scoreResultSchema.safeParse(inconsistent)
  assert.equal(result.success, false)
})

check("real scoring output always satisfies the contract", () => {
  for (const fixture of [strongLead, weakLead, missingBudget]) {
    const parsed = scoreResultSchema.safeParse(scoreLead(fixture))
    assert.ok(
      parsed.success,
      `output failed contract: ${JSON.stringify(
        parsed.success ? null : parsed.error.issues[0],
      )}`,
    )
  }
})

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
