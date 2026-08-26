import type { Signal } from "@/lib/contracts/leads"

/**
 * BrightPath's qualification policy.
 *
 * Everything a human would argue about lives in this one file: which industries
 * count as a fit, what budget clears the bar, how much a stated need is worth.
 * Changing policy means editing these constants and bumping the version — it
 * never means editing a prompt, because a prompt cannot be diffed, reviewed, or
 * reproduced.
 *
 * The structure follows BANT (Budget, Authority, Need, Timing), which is the
 * standard fit for SMB deal sizes. Authority is folded into interest, because in
 * an SMB the person filling in the form is usually the person who decides.
 *
 * The division of labour that makes this work:
 *
 *   The analyst reports FACTS  — "they have 40 staff", "they said £20k"
 *   The rubric applies POLICY  — "40 staff is our sweet spot", "£20k clears"
 *
 * Keeping policy out of the model is what makes a score reproducible. Same
 * evidence in, same number out, every time, with a reason attached to each point.
 */

/**
 * 1.1.0 — budget stopped being required in order to publish a score.
 *
 * Under 1.0.0 a lead that never mentioned money came back NEEDS_REVIEW with no
 * number at all, however plainly it described the problem. That was wrong about
 * how enquiries actually arrive: plenty of buyers with real budgets do not put
 * a figure in a web form, and answering them with "cannot determine" threw away
 * everything they had said.
 *
 * Budget now behaves like the other signals — stated and healthy earns its 20
 * points, absent earns 0 and drags the total down by itself. What stops a
 * no-figure lead being over-promoted is a gate rather than a refusal: see
 * HIGH_PRIORITY_REQUIRES_STATED_BUDGET below.
 */
export const RUBRIC_VERSION = "brightpath-bant-1.1.0"

/** Points available per signal. These must total 100. */
export const WEIGHTS: Record<Signal, number> = {
  company_fit: 20,
  industry_fit: 15,
  need: 25,
  budget: 20,
  interest: 20,
}

/**
 * Signals that must have evidence before any score is published.
 *
 * Only need. Without a problem there is nothing to assess — a score built on
 * company size and tone alone would be a confident-looking number about a lead
 * nobody can describe.
 *
 * Budget used to sit here too and no longer does (see RUBRIC_VERSION). It is
 * still the signal a model is most tempted to invent, but the defence against
 * that is the analyst refusing to estimate a figure from company size, not this
 * rubric refusing to score anyone who stayed quiet about money.
 *
 * MIN_CONFIDENCE remains the backstop: a lead missing several signals at once
 * still falls to NEEDS_REVIEW on coverage, so dropping budget widens what gets
 * scored without opening the door to scoring near-empty enquiries.
 */
export const REQUIRED_SIGNALS: Signal[] = ["need"]

/** Below this overall confidence the score is withheld for human review. */
export const MIN_CONFIDENCE = 0.5

export const PRIORITY_THRESHOLDS = { high: 70, medium: 40 } as const

/** At or above this, the lead is worth a rep's time. */
export const QUALIFIED_THRESHOLD = 40

/* ------------------------------------------------------------------ *
 * Company size — BrightPath sells to SMBs
 * ------------------------------------------------------------------ */

/**
 * Mid-size SMBs score full marks: large enough to have the problem and a
 * budget, small enough to buy without a procurement committee. Enterprises are
 * not penalised for being large — they are simply not who BrightPath serves,
 * and a long enterprise cycle is a poor use of a small sales team.
 */
export const COMPANY_SIZE_POINTS: Record<string, number> = {
  "1-9": 10,
  "10-49": 20,
  "50-249": 20,
  "250-999": 12,
  "1000+": 5,
}

/* ------------------------------------------------------------------ *
 * Industry fit
 * ------------------------------------------------------------------ */

/** Sectors BrightPath has delivered into and can show proof in. */
export const TARGET_INDUSTRIES = [
  "professional services",
  "accounting",
  "legal",
  "consulting",
  "financial services",
  "insurance",
  "healthcare",
  "logistics",
  "manufacturing",
  "construction",
  "real estate",
  "software",
  "technology",
  "retail",
  "hospitality",
  "education",
]

/** Plausible but unproven — worth pursuing, not worth prioritising. */
export const ADJACENT_INDUSTRIES = [
  "non-profit",
  "government",
  "agriculture",
  "energy",
  "media",
  "telecommunications",
  "transport",
  "wholesale",
]

export const INDUSTRY_POINTS = { target: 15, adjacent: 8, outside: 2 } as const

/* ------------------------------------------------------------------ *
 * Need
 * ------------------------------------------------------------------ */

/**
 * How plainly the lead described a problem BrightPath solves. This is a reading
 * judgement about their words, not a guess about their business — the analyst
 * must quote the text that earned the band.
 */
export const NEED_BANDS = [
  "explicit_urgent",
  "explicit",
  "implied",
  "none",
] as const
export type NeedBand = (typeof NEED_BANDS)[number]

export const NEED_POINTS: Record<NeedBand, number> = {
  explicit_urgent: 25,
  explicit: 20,
  implied: 10,
  none: 0,
}

/* ------------------------------------------------------------------ *
 * Budget
 * ------------------------------------------------------------------ */

/**
 * Annual figures in USD. The analyst extracts the number the lead actually
 * stated (converting currency if the lead named one) or reports the signal as
 * absent. It never estimates a budget from company size — that inference is
 * exactly the kind of plausible fiction this system exists to prevent.
 */
export const BUDGET_BANDS: Array<{ min: number; points: number; label: string }> =
  [
    { min: 25000, points: 20, label: "at or above $25k/yr" },
    { min: 10000, points: 16, label: "$10k–$25k/yr" },
    { min: 5000, points: 10, label: "$5k–$10k/yr" },
    { min: 1, points: 5, label: "under $5k/yr" },
  ]

/** The lead said outright that there is no budget. Explicit, and disqualifying. */
export const BUDGET_NONE_VALUE = "no_budget"

/* ------------------------------------------------------------------ *
 * Gates — conditions a weighted total must not be able to override
 * ------------------------------------------------------------------ */

/**
 * Some facts are not worth points, they are worth a verdict.
 *
 * A weighted sum will happily let four good signals outvote one fatal
 * one — a co-op that states outright it has no budget can still total 50
 * on the strength of a real problem and a friendly tone. That number is
 * arithmetically correct and commercially nonsense: there is no deal, and
 * sending a rep is unkind to both sides.
 *
 * BANT treats budget as a gate rather than a slider, and so do these.
 */

/** An explicit "we have no budget" ends the assessment, whatever else is true. */
export const NO_BUDGET_DISQUALIFIES = true

/**
 * Top priority requires a stated problem.
 *
 * "We know we're behind on tech" is an admission, not a requirement. Without
 * a named problem there is nothing to quote back, nothing to scope, and no
 * way to tell whether BrightPath is the right call — so a lead like that is
 * capped at MEDIUM no matter how well it scores elsewhere.
 */
export const HIGH_PRIORITY_REQUIRES_EXPLICIT_NEED = true
export const EXPLICIT_NEED_BANDS = ["explicit", "explicit_urgent"] as const

/**
 * Top priority requires a stated figure.
 *
 * This is what replaced budget's place in REQUIRED_SIGNALS, and it is the
 * difference between "we cannot assess this" and "we can, but not at the top of
 * the queue". A lead with a perfect problem, perfect sector and an eager tone
 * reaches 80 without ever naming a number — arithmetically HIGH, commercially
 * unproven, because nobody has established there is money behind it.
 *
 * Capping at MEDIUM says both true things at once: worth working, not worth
 * dropping a confirmed-budget lead for. The missing figure is the first thing
 * a rep should ask about, and it shows in the reasons for exactly that purpose.
 *
 * Note this deliberately does not care how large the stated budget is. A small
 * but real number still clears the gate; the rubric already prices size through
 * BUDGET_BANDS, and gating on size as well would penalise it twice.
 */
export const HIGH_PRIORITY_REQUIRES_STATED_BUDGET = true

/* ------------------------------------------------------------------ *
 * Replying to an enquiry that cannot be assessed
 * ------------------------------------------------------------------ */

/**
 * When the assistant writes a clarification instead of a sales follow-up.
 *
 * Two situations produce an enquiry there is nothing useful to say back to:
 * one too sparse to assess, and one describing something BrightPath does not
 * do. Both used to get a follow-up drafted anyway, which meant either a vague
 * message pretending to be personalised, or silence.
 *
 * Neither is what a person would do. A person would write back, say what they
 * would need to know to help, and invite the sender to fill in the gap. That
 * is what a clarification is, and it goes into the same human review queue as
 * every other draft — nothing here reaches a customer unread.
 *
 * Deliberately not a rejection. The system cannot tell a bad fit from a badly
 * worded enquiry, and the difference between those two is a follow-up
 * question, not a verdict.
 */
export const CLARIFY_WHEN_UNSCORABLE = true

/**
 * A lead describing no problem gets a clarification even when it scores.
 *
 * `need: "none"` is the closest thing the evidence has to "this is not about
 * anything we do" — an enquiry about something outside BrightPath's business
 * lands here, because no BrightPath-shaped problem could be quoted from it.
 * Pitching into that reads as though nobody looked.
 */
export const CLARIFY_WHEN_NO_NEED = true

/**
 * What to ask for, per missing signal, in a customer's words.
 *
 * Phrased as questions a person would actually ask. Interest is absent on
 * purpose: "how interested are you?" is not a question anyone asks a
 * prospective customer, and its answer is inferred from behaviour anyway.
 */
export const CLARIFY_PROMPTS: Partial<Record<Signal, string>> = {
  need: "what is going wrong today, and which part of the work it is slowing down",
  budget: "roughly what they have set aside, even as a range",
  company_fit: "how many people the business employs",
  industry_fit: "what the business does",
}

/* ------------------------------------------------------------------ *
 * Interest
 * ------------------------------------------------------------------ */

export const INTEREST_POINTS: Record<string, number> = {
  high: 20,
  medium: 12,
  low: 4,
}

/* ------------------------------------------------------------------ *
 * Speed to lead
 * ------------------------------------------------------------------ */

/**
 * Minutes from arrival to first real sales action.
 *
 * Research on B2B response times puts conversion around 21% when contact
 * happens inside five minutes, against roughly 2.3% the following day, while
 * the industry average sits near 42 hours. Fifteen minutes is an SLA a small
 * team can actually hold; the point is that the clock is visible and honest,
 * not that the number is heroic.
 */
export const DEFAULT_SLA_MINUTES = 15

export function slaMinutes(): number {
  const raw = Number(process.env.SLA_FIRST_TOUCH_MINUTES)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SLA_MINUTES
}

/** Vocabulary the analyst must choose from, enforced at parse time. */
export const SIGNAL_VOCABULARY = {
  company_fit: Object.keys(COMPANY_SIZE_POINTS),
  industry_fit: "free text: the industry the lead operates in",
  need: NEED_BANDS as readonly string[],
  budget: `a number (annual USD) or "${BUDGET_NONE_VALUE}"`,
  interest: Object.keys(INTEREST_POINTS),
} as const
