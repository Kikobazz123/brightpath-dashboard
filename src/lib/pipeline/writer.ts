import {
  followUpDraftSchema,
  type Evidence,
  type FollowUpDraft,
  type ScoreResult,
  type Signal,
} from "@/lib/contracts/leads"
import { generateStructured, registerStub } from "@/lib/ai/provider"

/**
 * Follow-Up Writer.
 *
 * The one stage where a model earns its place: writing a short, specific email
 * is genuine language work that a template does badly.
 *
 * It is given only the evidence — the facts the lead actually stated, each with
 * its quote. It is not given the score, because a message should never leak
 * that the sender ranked the recipient, and it is not given the raw lead text,
 * because that is where the temptation to embellish lives.
 */

const SYSTEM_PROMPT = `You write short follow-up emails for BrightPath Solutions, which sells software and professional services to small and medium businesses.

You will be given only the confirmed facts about a lead. Each fact was quoted from something the lead actually wrote.

Rules:
- Use only the facts given. If a fact is not listed, you do not know it. Never invent a company detail, a team size, a budget, a deadline, a mutual connection, or a previous conversation.
- Reference at least one specific fact. A message that could have been sent to anyone is worse than no message.
- Six sentences maximum. Busy people reply to short emails.
- One clear ask, matched to what they asked for. Do not stack requests.
- Plain professional English. No "I hope this email finds you well", no exclamation marks, no invented enthusiasm.
- Sign off as "The BrightPath Team". Never sign a specific person's name.
- If the facts are too thin to personalise honestly, write a brief message that asks for the missing detail instead of padding with flattery.

Return the subject line, the message body, and the list of signals you actually referenced.`

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "message", "grounded_in"],
  properties: {
    subject: { type: "string" },
    message: { type: "string" },
    grounded_in: {
      type: "array",
      items: {
        type: "string",
        enum: ["company_fit", "industry_fit", "need", "budget", "interest"],
      },
    },
  },
} as const

registerStub(SYSTEM_PROMPT, () => ({
  subject: "[Draft unavailable — no AI provider configured]",
  message:
    "No AI provider is configured, so no follow-up was written.\n\n" +
    "Set AI_PROVIDER and the matching key in .env.local to enable drafting. " +
    "Nothing has been sent.",
  grounded_in: [],
}))

/** Render evidence as the fact list the writer is allowed to draw on. */
function factSheet(evidence: Evidence, contactName: string | null): string {
  const known = evidence.items.filter((i) => i.present && i.value)

  const lines = known.map(
    (i) => `- ${i.signal}: ${i.value} (they wrote: "${i.source_span}")`,
  )

  if (contactName) lines.unshift(`- contact name: ${contactName}`)

  if (known.length === 0) {
    return "No facts were confirmed for this lead. Ask for the basics rather than guessing."
  }

  const notes = evidence.context_notes.length
    ? `\n\nOther context:\n${evidence.context_notes.map((n) => `- ${n}`).join("\n")}`
    : ""

  return `Confirmed facts:\n${lines.join("\n")}${notes}`
}

export interface WriteResult {
  draft: FollowUpDraft
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
}

export async function writeFollowUp(
  evidence: Evidence,
  contactName: string | null,
  _assessment: ScoreResult | null,
): Promise<WriteResult> {
  const result = await generateStructured({
    system: SYSTEM_PROMPT,
    user: factSheet(evidence, contactName),
    schema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: 1024,
  })

  const raw = (result.json ?? {}) as Record<string, unknown>

  /**
   * Keep only signals the lead actually evidenced. A model claiming it
   * referenced a budget it was never given would make the provenance display
   * lie, which defeats the point of showing it.
   */
  const evidenced = new Set(
    evidence.items.filter((i) => i.present).map((i) => i.signal),
  )
  const grounded = Array.isArray(raw.grounded_in)
    ? (raw.grounded_in as Signal[]).filter((s) => evidenced.has(s))
    : []

  const parsed = followUpDraftSchema.safeParse({
    subject: typeof raw.subject === "string" ? raw.subject : "Following up",
    message: typeof raw.message === "string" ? raw.message : "",
    grounded_in: grounded,
    generated_at: new Date().toISOString(),
    model: `${result.provider}:${result.model}`,
  })

  if (!parsed.success) {
    return {
      draft: {
        subject: "[Draft failed validation]",
        message:
          "The generated follow-up did not match the expected shape and was discarded. Nothing has been sent.",
        grounded_in: [],
        generated_at: new Date().toISOString(),
        model: `${result.provider}:${result.model}`,
      },
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: result.durationMs,
    }
  }

  return {
    draft: parsed.data,
    provider: result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    durationMs: result.durationMs,
  }
}

export const WRITER_SYSTEM_PROMPT = SYSTEM_PROMPT
