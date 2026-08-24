/**
 * Does the configured AI provider actually work?
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-provider.ts
 *
 * No database. One real call to whichever provider `AI_PROVIDER` names, using
 * a sample lead that states all five signals clearly, so anything short of a
 * full extraction points at configuration rather than at a hard lead.
 *
 * This exists because of a specific trap. A bad key, a wrong model name or a
 * schema the provider will not accept all come back as a 400, a 400 is not
 * retryable, and the pipeline is designed to degrade to stub output rather
 * than drop a lead on the floor. That is the right behaviour in production and
 * a miserable one while setting up: every lead reads NEEDS_REVIEW and nothing
 * says why. This script makes the failure loud and names the cause.
 */

import { analyzeLead } from "../src/lib/pipeline/analyst"
import { writeFollowUp } from "../src/lib/pipeline/writer"
import { scoreLead } from "../src/lib/pipeline/scoring"
import { activeProvider } from "../src/lib/ai/provider"

/** States company size, industry, need with a deadline, budget and intent. */
const SAMPLE = `Hi — we are a 40-person accountancy practice in Leeds and our
client onboarding is completely manual. Every new client takes about three
hours of admin across four different spreadsheets, and we are onboarding
around fifteen a month now.

We have set aside about £25,000 for this and we need something live before our
year end in April. Could we get a call this week?`

const EXPECTED = ["company_fit", "industry_fit", "need", "budget", "interest"]

async function main() {
  const configured = activeProvider()

  console.log(`\nProvider check — AI_PROVIDER="${configured}"\n`)

  if (configured === "stub") {
    console.log("  AI_PROVIDER is \"stub\", so no model will be called.")
    console.log("  Every captured lead will read NEEDS_REVIEW with no draft.")
    console.log("\n  To enable extraction, set in .env.local:")
    console.log('    AI_PROVIDER="gemini"')
    console.log('    GEMINI_API_KEY="..."   # https://aistudio.google.com/apikey')
    console.log("")
    process.exit(1)
  }

  console.log("Extraction")
  const analysis = await analyzeLead(SAMPLE)
  const usedStub = analysis.provider === "stub" || /^stub/.test(analysis.model)

  if (usedStub) {
    console.log(`  FAIL  the call fell back to stub (${analysis.model})`)
    console.log("        The reason was logged above, prefixed [ai].")
    console.log("        Usual causes: an invalid key, a model name that does")
    console.log("        not exist for this account, or no network.")
    console.log("")
    process.exit(1)
  }

  console.log(`  PASS  answered by ${analysis.provider}:${analysis.model}`)
  console.log(
    `        ${analysis.durationMs}ms · in ${analysis.inputTokens ?? "?"} tokens` +
      ` · out ${analysis.outputTokens ?? "?"} tokens`,
  )

  const found = analysis.evidence.items.filter((i) => i.present)
  console.log(`  ${found.length}/5 signals extracted:`)
  for (const signal of EXPECTED) {
    const item = analysis.evidence.items.find((i) => i.signal === signal)
    if (item?.present) {
      console.log(`    ${signal.padEnd(13)} ${item.value}`)
      console.log(`      quoted: "${truncate(item.source_span ?? "", 70)}"`)
    } else {
      console.log(`    ${signal.padEnd(13)} not found`)
    }
  }

  // Every signal is stated outright in the sample, so a miss here is the model
  // being cautious or the prompt drifting — not a property of the lead.
  if (found.length < EXPECTED.length) {
    console.log(
      `\n  NOTE  ${EXPECTED.length - found.length} signal(s) missed. The sample states all five,` +
        `\n        so this is worth a look before demoing.`,
    )
  }

  console.log("\nScoring (deterministic — no provider involved)")
  const assessment = scoreLead(analysis.evidence)
  console.log(
    `  score ${assessment.score ?? "—"} · ${assessment.priority ?? "no priority"}` +
      ` · ${assessment.qualification_status}` +
      ` · confidence ${Math.round(assessment.confidence * 100)}%`,
  )

  console.log("\nDrafting")
  const draft = await writeFollowUp(
    analysis.evidence,
    "Sample Contact",
    assessment,
  )

  if (draft.provider === "stub" || /^stub/.test(draft.model)) {
    console.log(`  FAIL  the writer fell back to stub (${draft.model})`)
    console.log("")
    process.exit(1)
  }

  console.log(`  PASS  answered by ${draft.provider}:${draft.model}`)
  console.log(`  subject: ${draft.draft.subject}`)
  console.log(`  grounded in: ${draft.draft.grounded_in.join(", ") || "nothing"}`)
  console.log("")
  console.log(indent(draft.draft.message))

  console.log("\nProvider is working end to end.\n")
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")
}

main().catch((error) => {
  console.error("\nProvider check failed to run:")
  console.error(`  ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
