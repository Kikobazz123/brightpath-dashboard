import {
  evidenceSchema,
  SIGNALS,
  type Evidence,
} from "@/lib/contracts/leads"
import { generateStructured, registerStub } from "@/lib/ai/provider"

import {
  BUDGET_NONE_VALUE,
  COMPANY_SIZE_POINTS,
  INTEREST_POINTS,
  NEED_BANDS,
} from "./rubric"

/**
 * Lead Analyst — reads a lead and reports what it actually says.
 *
 * This stage does exactly one job: turn prose into evidence. It does not score,
 * rank, or advise, and it has never been told what a "good" lead looks like —
 * telling it would invite it to flatter the lead it is reading. Scoring happens
 * afterwards, in code, against a rubric the model never sees.
 *
 * The one rule everything else depends on: every claim must quote the text it
 * came from. A signal with no supporting quote is reported absent, which is a
 * useful answer. An invented one is not.
 */

const SYSTEM_PROMPT = `You extract structured evidence from sales leads for BrightPath Solutions.

Your only job is to report what the lead's own words state. You are not judging lead quality, and you must never estimate, infer, or fill gaps with what is typical.

For each of the five signals, decide whether the lead's text actually states it.

- If it does: set present=true, give the normalised value, and quote the exact supporting text in source_span. The quote must appear verbatim in the input.
- If it does not: set present=false, value=null, source_span=null, confidence=0.

Do not infer budget from company size. Do not infer industry from a person's job title alone. Do not upgrade a vague comment into a stated need. Missing information is a legitimate and useful finding — a rep can go and ask. A confident guess cannot be unasked.

Signal vocabularies, which you must use exactly:

- company_fit: one of ${Object.keys(COMPANY_SIZE_POINTS).join(", ")} (employee count band)
- industry_fit: the industry in plain words, e.g. "accounting", "logistics"
- need: one of ${NEED_BANDS.join(", ")}
    explicit_urgent = names a specific problem AND a deadline or pressure
    explicit        = names a specific problem
    implied         = hints at a problem without naming it
    none            = describes no problem
- budget: the annual figure in USD as a plain number (convert if another currency is named), or "${BUDGET_NONE_VALUE}" if they state they have no budget
- interest: one of ${Object.keys(INTEREST_POINTS).join(", ")}
    high   = asked for a call, demo, quote, or next step
    medium = engaged with specifics but asked for nothing
    low    = general browsing or vague curiosity

confidence is 0-1: how unambiguously the quoted text supports the value. Hedge honestly — a passing mention is not 0.9.

Put anything else worth a rep knowing into context_notes.`

/** JSON Schema constraining the response shape at the provider level. */
const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "context_notes"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["signal", "present", "value", "source_span", "confidence"],
        properties: {
          signal: { type: "string", enum: [...SIGNALS] },
          present: { type: "boolean" },
          value: { type: ["string", "null"] },
          source_span: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          note: { type: ["string", "null"] },
        },
      },
    },
    context_notes: { type: "array", items: { type: "string" } },
  },
} as const

/**
 * With no provider configured, report every signal as absent.
 *
 * This is the honest stub: it claims nothing, so the rubric sends the lead to
 * NEEDS_REVIEW. A stub that invented plausible evidence would make the demo
 * look better and the system worthless.
 */
registerStub(SYSTEM_PROMPT, () => ({
  items: SIGNALS.map((signal) => ({
    signal,
    present: false,
    value: null,
    source_span: null,
    confidence: 0,
    note: "No AI provider configured — nothing was extracted.",
  })),
  context_notes: [
    "Extraction did not run: set AI_PROVIDER and a key to enable it.",
  ],
}))

export interface AnalyzeResult {
  evidence: Evidence
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
}

/**
 * Drop any claim whose quote does not appear in the source text.
 *
 * The prompt asks for verbatim quotes; this checks. A model that paraphrases
 * its evidence has lost the thread, and the safe reading of an unverifiable
 * claim is that the signal is absent — which is what this does, rather than
 * failing the whole extraction.
 */
function dropUnverifiableClaims(raw: unknown, sourceText: string): unknown {
  if (typeof raw !== "object" || raw === null) return raw
  const record = raw as { items?: unknown }
  if (!Array.isArray(record.items)) return raw

  const haystack = sourceText.toLowerCase().replace(/\s+/g, " ")

  const items = record.items.map((entry) => {
    const item = entry as Record<string, unknown>
    if (item.present !== true) {
      return { ...item, value: null, source_span: null, confidence: 0 }
    }

    const span = typeof item.source_span === "string" ? item.source_span : ""
    const needle = span.toLowerCase().replace(/\s+/g, " ").trim()

    if (!needle || !haystack.includes(needle)) {
      return {
        ...item,
        present: false,
        value: null,
        source_span: null,
        confidence: 0,
        note: "Dropped: the cited quote does not appear in the lead's text.",
      }
    }
    return item
  })

  return { ...record, items }
}

export async function analyzeLead(normalizedContext: string): Promise<AnalyzeResult> {
  const result = await generateStructured({
    system: SYSTEM_PROMPT,
    user: `Lead information:\n\n"""\n${normalizedContext}\n"""`,
    schema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: 2048,
  })

  const cleaned = dropUnverifiableClaims(result.json, normalizedContext)

  const parsed = evidenceSchema.safeParse({
    ...(cleaned as object),
    extracted_at: new Date().toISOString(),
    model: `${result.provider}:${result.model}`,
  })

  if (!parsed.success) {
    /**
     * A malformed extraction is treated as no extraction. Salvaging fragments
     * risks keeping exactly the fabricated field that broke validation.
     */
    const empty: Evidence = {
      items: SIGNALS.map((signal) => ({
        signal,
        present: false,
        value: null,
        source_span: null,
        confidence: 0,
        note: "Extraction failed validation; treated as no evidence.",
      })),
      context_notes: [
        `Analyst output rejected: ${parsed.error.issues[0]?.message ?? "unknown"}`,
      ],
      extracted_at: new Date().toISOString(),
      model: `${result.provider}:${result.model}`,
    }
    return { ...result, evidence: empty, model: result.model }
  }

  return {
    evidence: parsed.data,
    provider: result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    durationMs: result.durationMs,
  }
}

export const ANALYST_SYSTEM_PROMPT = SYSTEM_PROMPT
