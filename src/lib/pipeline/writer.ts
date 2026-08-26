import {
  SIGNALS,
  followUpDraftSchema,
  type DraftKind,
  type Evidence,
  type FollowUpDraft,
  type ScoreResult,
  type Signal,
} from "@/lib/contracts/leads"
import { generateStructured, registerStub } from "@/lib/ai/provider"
import {
  CLARIFY_PROMPTS,
  CLARIFY_WHEN_NO_NEED,
  CLARIFY_WHEN_UNSCORABLE,
} from "./rubric"

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
- Lay it out as an email, not one block of prose: greeting on its own line, a blank line before the sign-off, and the team name on the line below it.
- If the facts are too thin to personalise honestly, write a brief message that asks for the missing detail instead of padding with flattery.

Return the subject line, the message body, and the list of signals you actually referenced.`

/**
 * The prompt used when there is nothing solid enough to follow up on.
 *
 * The hard part is tone. This message goes to someone who has just taken the
 * trouble to contact a company, and the honest content of it is "we cannot
 * work out what you need" — which is easy to write in a way that reads as
 * being marked wrong. So the rules below spend most of their effort on not
 * doing that: no judgement about the enquiry, no implication of a mistake,
 * and questions rather than requirements.
 *
 * It also never says the enquiry was unscorable, or that anything scored it.
 * That is our internal machinery and would be alarming to read.
 */
const CLARIFY_PROMPT = `You write short replies for BrightPath Solutions, which designs, builds and supports custom software for small and medium businesses: internal tools, integrations, and full product builds.

Someone has sent an enquiry that does not yet contain enough for a colleague to give them a useful answer. Your job is to write back and ask for what is missing, so they can reply once and get a real response.

Rules:
- Be warm and brief. Thank them for getting in touch. Five sentences maximum.
- Never suggest they did anything wrong, left anything out, or filled a form in badly. The gap is ours to close by asking.
- Never mention scoring, qualification, assessment, review, or any internal process. There is no system, only a company writing back.
- Ask only for the specific details listed as missing. Put them as natural questions, not as a form or a bulleted list of requirements.
- If nothing about the enquiry relates to building or supporting software, do not say they are the wrong fit — say plainly what BrightPath does, and ask what they are trying to achieve, so they can tell you if there is something there.
- Never invent a detail about their business, and never guess what their problem might be.
- No pricing, no sales pitch, no promises about what BrightPath can deliver — nothing has been established yet.
- Sign off as "The BrightPath Team". Never sign a specific person's name.
- Lay it out as an email: greeting on its own line, a blank line before the sign-off, and the team name on the line below it.

Return the subject line, the message body, and an empty list for the signals referenced.`

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

/**
 * The clarification path needs its own stub.
 *
 * Stubs are keyed on the system prompt, so without this an unconfigured
 * install would throw on exactly the enquiries that most need handling — the
 * thin ones. Same honest placeholder as above.
 */
registerStub(CLARIFY_PROMPT, () => ({
  subject: "[Draft unavailable — no AI provider configured]",
  message:
    "This enquiry needs more detail before anyone can answer it, but no AI " +
    "provider is configured, so no reply was written.\n\n" +
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

/**
 * Put the email back into paragraphs.
 *
 * Structured JSON output has a strong pull toward a single unbroken string —
 * asked for a "message", models reliably return one long line — and the result
 * arrives in someone's inbox reading "...available this week? Best regards, The
 * BrightPath Team" with the sign-off welded to the last sentence. The prompt
 * now asks for line breaks, but a prompt is a request rather than a guarantee,
 * so the shape is enforced here instead.
 *
 * Only whitespace is touched. No word is added, removed, or reordered — this
 * runs on model output that has already been validated, and quietly rewriting
 * the wording would put prose in the message that nothing has checked.
 */
const GREETING = /^((?:Hi|Hello|Dear|Good morning|Good afternoon)\b[^,\n]{0,60},)\s*/i
const SIGN_OFF =
  /\s*\b((?:Best regards|Kind regards|Warm regards|Regards|Many thanks|Thanks|Thank you))\s*,?\s*(The BrightPath Team)\.?\s*$/i

export function tidyMessage(raw: string): string {
  let text = (raw ?? "").replace(/\r\n?/g, "\n").trim()
  if (!text) return text

  // Peel the sign-off off the end first, so the greeting match cannot reach it.
  let signOff = ""
  const closing = text.match(SIGN_OFF)
  if (closing) {
    signOff = `${closing[1]},\n${closing[2]}`
    text = text.slice(0, closing.index).trim()
  }

  let greeting = ""
  const opening = text.match(GREETING)
  if (opening) {
    greeting = opening[1]
    text = text.slice(opening[0].length).trim()
  }

  const body = text
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return [greeting, body, signOff].filter(Boolean).join("\n\n")
}

/**
 * Which kind of message this enquiry warrants.
 *
 * Policy, so it is decided here in code rather than by asking the model to
 * judge its own footing — a model asked "can you personalise this?" will
 * almost always say yes.
 *
 * The assessment is read for `qualification_status` only. The score itself is
 * never consulted and never reaches a prompt: which message to write is a
 * different question from how good the lead is, and a low-scoring lead that
 * stated its problem clearly still gets a proper follow-up.
 */
export function chooseDraftKind(
  evidence: Evidence,
  assessment: ScoreResult | null,
): DraftKind {
  if (CLARIFY_WHEN_UNSCORABLE && assessment?.qualification_status === "NEEDS_REVIEW") {
    return "clarification"
  }

  if (CLARIFY_WHEN_NO_NEED) {
    const need = evidence.items.find((i) => i.signal === "need")
    const stated = need?.present && need.value && need.value !== "none"
    if (!stated) return "clarification"
  }

  return "follow_up"
}

/**
 * What to ask for, in the order the rubric lists it.
 *
 * Only signals with no evidence at all. A signal the lead answered vaguely is
 * still an answer, and asking again for something they believe they already
 * told you is the fastest way to look like nobody read it.
 */
function missingSheet(evidence: Evidence): string {
  const known = evidence.items
    .filter((i) => i.present && i.value && i.value !== "none")
    .map((i) => `- ${i.signal}: ${i.value}`)

  const context = known.length
    ? `What they did tell us, which you may refer to:\n${known.join("\n")}\n\n`
    : "They told us nothing we could pin down.\n\n"

  const need = evidence.items.find((i) => i.signal === "need")
  const describedAProblem = Boolean(
    need?.present && need.value && need.value !== "none",
  )

  /**
   * No problem described at all — which is where a genuinely off-topic enquiry
   * lands, someone asking whether we sell generators.
   *
   * Asking that person their headcount and budget is worse than saying
   * nothing: it implies we are quoting for the thing they asked about, and
   * they answer three questions before discovering we were never the right
   * company. So those asks are suppressed and the reply leads with what
   * BrightPath actually does, which lets them rule us out in one line — or
   * discover there is a software problem worth describing after all.
   */
  if (!describedAProblem) {
    return (
      `${context}They have not described a problem BrightPath could work on. ` +
      `This may be an enquiry about something we do not do at all.\n\n` +
      `Do NOT ask about budget, headcount, or industry — nothing has been ` +
      `established yet, and asking would imply we are already quoting for ` +
      `whatever they had in mind.\n\n` +
      `Instead: say plainly and briefly that BrightPath designs, builds and ` +
      `supports custom software — internal tools, integrations and full ` +
      `product builds — and ask what they are trying to achieve, so they can ` +
      `tell you whether there is something there. Leave the door open without ` +
      `promising anything.`
    )
  }

  const absent = SIGNALS.filter((signal) => {
    const item = evidence.items.find((i) => i.signal === signal)
    return !item?.present || item.value === null || item.value === "none"
  })

  const asks = absent
    .map((signal) => CLARIFY_PROMPTS[signal])
    .filter((ask): ask is string => Boolean(ask))

  return asks.length
    ? `${context}They have described a problem, so this is a real enquiry — it ` +
        `is simply missing detail.\n\nAsk for these, and nothing else:\n${asks
          .map((a) => `- ${a}`)
          .join("\n")}`
    : `${context}Ask them to describe what is going wrong in a little more detail.`
}

export interface WriteResult {
  draft: FollowUpDraft
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
  /**
   * Why the stub answered instead of the configured provider, if it did.
   *
   * The analyst puts its equivalent into the evidence context notes, where the
   * UI already shows it. A draft has nowhere comparable to put a note without
   * it reading as part of the message, so this rides on the activity payload
   * instead — see `runFollowUp`.
   */
  degradedReason?: string
}

export async function writeFollowUp(
  evidence: Evidence,
  contactName: string | null,
  assessment: ScoreResult | null,
): Promise<WriteResult> {
  /**
   * An enquiry too thin to act on gets a different message, not a worse one.
   *
   * The old behaviour ran the sales prompt regardless and leaned on a single
   * rule inside it to cope, which produced a follow-up that referenced nothing
   * and asked for nothing in particular. Choosing the prompt in code instead
   * means the request for detail is specific, and that a clarification is
   * labelled as one rather than filed as a pitch.
   */
  const kind = chooseDraftKind(evidence, assessment)
  const clarifying = kind === "clarification"

  const result = await generateStructured({
    system: clarifying ? CLARIFY_PROMPT : SYSTEM_PROMPT,
    user: clarifying
      ? `${contactName ? `Their name: ${contactName}\n\n` : ""}${missingSheet(evidence)}`
      : factSheet(evidence, contactName),
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
    subject:
      typeof raw.subject === "string"
        ? raw.subject.trim()
        : clarifying
          ? "A couple of questions about your enquiry"
          : "Following up",
    message: typeof raw.message === "string" ? tidyMessage(raw.message) : "",
    kind,
    /**
     * A clarification is grounded in nothing by construction — it asks about
     * what is missing rather than drawing on what is there. Forcing the list
     * empty stops the provenance row claiming a personalisation that the
     * message does not contain.
     */
    grounded_in: clarifying ? [] : grounded,
    generated_at: new Date().toISOString(),
    model: `${result.provider}:${result.model}`,
  })

  if (!parsed.success) {
    return {
      draft: {
        subject: "[Draft failed validation]",
        message:
          "The generated follow-up did not match the expected shape and was discarded. Nothing has been sent.",
        kind,
        grounded_in: [],
        generated_at: new Date().toISOString(),
        model: `${result.provider}:${result.model}`,
      },
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: result.durationMs,
      degradedReason: result.degradedReason,
    }
  }

  return {
    draft: parsed.data,
    provider: result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    durationMs: result.durationMs,
    degradedReason: result.degradedReason,
  }
}

export const WRITER_SYSTEM_PROMPT = SYSTEM_PROMPT
