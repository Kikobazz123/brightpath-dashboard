import {
  type Evidence,
  type EvidenceItem,
  type Priority,
  type QualificationStatus,
  type ScoreReason,
  type ScoreResult,
  type Signal,
  SIGNALS,
} from "@/lib/contracts/leads"

import {
  ADJACENT_INDUSTRIES,
  BUDGET_BANDS,
  BUDGET_NONE_VALUE,
  COMPANY_SIZE_POINTS,
  EXPLICIT_NEED_BANDS,
  HIGH_PRIORITY_REQUIRES_EXPLICIT_NEED,
  INDUSTRY_POINTS,
  INTEREST_POINTS,
  MIN_CONFIDENCE,
  NO_BUDGET_DISQUALIFIES,
  NEED_POINTS,
  PRIORITY_THRESHOLDS,
  QUALIFIED_THRESHOLD,
  REQUIRED_SIGNALS,
  RUBRIC_VERSION,
  TARGET_INDUSTRIES,
  WEIGHTS,
  type NeedBand,
} from "./rubric"

/**
 * Scoring.
 *
 * A pure function: same evidence in, same result out, no clock, no randomness,
 * no network, no database. That is what makes the number defensible — anyone
 * can re-run it and get the same answer, and every point traces to a rubric line.
 *
 * The model is nowhere near this file. It supplied the evidence; the arithmetic
 * is ours.
 */

/** Look up one signal in the evidence set. */
function find(evidence: Evidence, signal: Signal): EvidenceItem | undefined {
  return evidence.items.find((i) => i.signal === signal)
}

function classifyIndustry(raw: string): keyof typeof INDUSTRY_POINTS {
  const value = raw.trim().toLowerCase()
  if (!value) return "outside"
  const hit = (list: string[]) =>
    list.some((entry) => value.includes(entry) || entry.includes(value))
  if (hit(TARGET_INDUSTRIES)) return "target"
  if (hit(ADJACENT_INDUSTRIES)) return "adjacent"
  return "outside"
}

/**
 * Parse a stated budget into annual USD.
 *
 * Returns null when the text can't be read as a figure — which routes the
 * signal to "missing" rather than to a guess. Tolerates the shapes people
 * actually type: "$20,000", "20k", "USD 15000".
 */
function parseBudget(raw: string): number | null {
  const value = raw.trim().toLowerCase()
  if (!value) return null
  if (value === BUDGET_NONE_VALUE) return 0

  const match = value.match(/([\d,]+(?:\.\d+)?)\s*(k|m)?/)
  if (!match) return null

  const base = Number(match[1].replace(/,/g, ""))
  if (!Number.isFinite(base)) return null

  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1
  return base * multiplier
}

function scoreCompanyFit(item: EvidenceItem): ScoreReason {
  const points = COMPANY_SIZE_POINTS[item.value ?? ""] ?? 0
  const known = item.value != null && item.value in COMPANY_SIZE_POINTS
  return {
    signal: "company_fit",
    points_awarded: points,
    points_possible: WEIGHTS.company_fit,
    direction: points >= 15 ? "positive" : points >= 8 ? "neutral" : "negative",
    explanation: known
      ? `${item.value} employees — ${
          points >= 15
            ? "squarely in BrightPath's SMB range"
            : points >= 8
              ? "outside the core range but workable"
              : "larger than BrightPath's target customer"
        }.`
      : "Company size was reported in a form the rubric does not recognise.",
  }
}

function scoreIndustryFit(item: EvidenceItem): ScoreReason {
  const band = classifyIndustry(item.value ?? "")
  const points = INDUSTRY_POINTS[band]
  return {
    signal: "industry_fit",
    points_awarded: points,
    points_possible: WEIGHTS.industry_fit,
    direction:
      band === "target" ? "positive" : band === "adjacent" ? "neutral" : "negative",
    explanation: `"${item.value}" classified as ${band}${
      band === "target"
        ? " — a sector BrightPath has delivered in"
        : band === "adjacent"
          ? " — plausible, without existing proof"
          : " — outside the sectors BrightPath serves"
    }.`,
  }
}

function scoreNeed(item: EvidenceItem): ScoreReason {
  const band = (item.value ?? "none") as NeedBand
  const points = NEED_POINTS[band] ?? 0
  return {
    signal: "need",
    points_awarded: points,
    points_possible: WEIGHTS.need,
    direction: points >= 20 ? "positive" : points >= 10 ? "neutral" : "negative",
    explanation:
      band === "explicit_urgent"
        ? "Stated a specific problem and a reason it is urgent."
        : band === "explicit"
          ? "Stated a specific problem BrightPath addresses."
          : band === "implied"
            ? "Hinted at a problem without naming it directly."
            : "No problem described.",
  }
}

function scoreBudget(item: EvidenceItem): ScoreReason {
  const amount = parseBudget(item.value ?? "")

  if (amount === null) {
    return {
      signal: "budget",
      points_awarded: 0,
      points_possible: WEIGHTS.budget,
      direction: "neutral",
      explanation: "Budget was mentioned but could not be read as a figure.",
    }
  }

  if (amount === 0) {
    return {
      signal: "budget",
      points_awarded: 0,
      points_possible: WEIGHTS.budget,
      direction: "negative",
      explanation: "Stated outright that no budget is available.",
    }
  }

  const band = BUDGET_BANDS.find((b) => amount >= b.min)
  const points = band?.points ?? 0
  return {
    signal: "budget",
    points_awarded: points,
    points_possible: WEIGHTS.budget,
    direction: points >= 16 ? "positive" : points >= 10 ? "neutral" : "negative",
    explanation: `Stated budget of about $${amount.toLocaleString("en-US")}/yr — ${
      band?.label ?? "below the scoring floor"
    }.`,
  }
}

function scoreInterest(item: EvidenceItem): ScoreReason {
  const points = INTEREST_POINTS[item.value ?? ""] ?? 0
  return {
    signal: "interest",
    points_awarded: points,
    points_possible: WEIGHTS.interest,
    direction: points >= 20 ? "positive" : points >= 12 ? "neutral" : "negative",
    explanation:
      item.value === "high"
        ? "Asked to speak to someone or requested a next step."
        : item.value === "medium"
          ? "Engaged with the offer without asking for a next step."
          : "Browsing rather than buying.",
  }
}

const SCORERS: Record<Signal, (item: EvidenceItem) => ScoreReason> = {
  company_fit: scoreCompanyFit,
  industry_fit: scoreIndustryFit,
  need: scoreNeed,
  budget: scoreBudget,
  interest: scoreInterest,
}

/** A signal with no evidence scores zero, and says so rather than staying silent. */
function absentReason(signal: Signal): ScoreReason {
  return {
    signal,
    points_awarded: 0,
    points_possible: WEIGHTS[signal],
    direction: "neutral",
    explanation: "Not stated by the lead — no points awarded, nothing assumed.",
  }
}

export interface ScoreOptions {
  /** Injected so the result is testable without touching the clock. */
  now?: Date
}

/**
 * Turn evidence into a score, a priority, and a qualification status.
 *
 * Withholds the number entirely when a required signal is missing or overall
 * confidence is too low. A withheld score tells a rep to go and ask; a
 * fabricated one sends them in confidently wrong.
 */
export function scoreLead(
  evidence: Evidence,
  options: ScoreOptions = {},
): ScoreResult {
  const now = options.now ?? new Date()

  const reasons: ScoreReason[] = []
  const missing: Signal[] = []
  let confidenceWeightedSum = 0
  let presentWeight = 0

  for (const signal of SIGNALS) {
    const item = find(evidence, signal)

    if (!item || !item.present || item.value === null) {
      missing.push(signal)
      reasons.push(absentReason(signal))
      continue
    }

    reasons.push(SCORERS[signal](item))
    presentWeight += WEIGHTS[signal]
    confidenceWeightedSum += WEIGHTS[signal] * item.confidence
  }

  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)

  /**
   * Confidence blends coverage with certainty: a lead where every signal is
   * present but each was a guess should not read as confident, and neither
   * should one where two crisp facts carry the whole picture.
   */
  const confidence =
    totalWeight === 0 ? 0 : Number((confidenceWeightedSum / totalWeight).toFixed(4))

  const missingRequired = REQUIRED_SIGNALS.filter((s) => missing.includes(s))
  const needsReview = missingRequired.length > 0 || confidence < MIN_CONFIDENCE

  if (needsReview) {
    return {
      rubric_version: RUBRIC_VERSION,
      score: null,
      priority: null,
      qualification_status: "NEEDS_REVIEW",
      confidence,
      reasons,
      missing_information: missing,
      scored_at: now.toISOString(),
    }
  }

  const score = reasons.reduce((sum, r) => sum + r.points_awarded, 0)
  const clamped = Math.max(0, Math.min(100, Math.round(score)))

  let priority: Priority =
    clamped >= PRIORITY_THRESHOLDS.high
      ? "HIGH"
      : clamped >= PRIORITY_THRESHOLDS.medium
        ? "MEDIUM"
        : "LOW"

  let qualification_status: QualificationStatus =
    clamped >= QUALIFIED_THRESHOLD ? "QUALIFIED" : "NOT_QUALIFIED"

  /**
   * Gates run after the arithmetic and can only ever lower the outcome.
   *
   * The score itself is left untouched so the reasoning stays visible — a rep
   * seeing "50/100, not qualified" alongside the budget line learns more than
   * one seeing a silently rewritten zero.
   */
  const budgetItem = find(evidence, "budget")
  if (
    NO_BUDGET_DISQUALIFIES &&
    budgetItem?.present &&
    budgetItem.value?.trim().toLowerCase() === BUDGET_NONE_VALUE
  ) {
    qualification_status = "NOT_QUALIFIED"
    priority = "LOW"
    reasons.push({
      signal: "budget",
      points_awarded: 0,
      points_possible: 0,
      direction: "negative",
      explanation:
        "Gate: the lead stated outright that no budget exists, which ends qualification regardless of the other signals.",
    })
  }

  const needItem = find(evidence, "need")
  if (
    HIGH_PRIORITY_REQUIRES_EXPLICIT_NEED &&
    priority === "HIGH" &&
    !(EXPLICIT_NEED_BANDS as readonly string[]).includes(needItem?.value ?? "")
  ) {
    priority = "MEDIUM"
    reasons.push({
      signal: "need",
      points_awarded: 0,
      points_possible: 0,
      direction: "neutral",
      explanation:
        "Gate: capped at MEDIUM because no specific problem was stated — there is nothing concrete to scope a call around yet.",
    })
  }

  return {
    rubric_version: RUBRIC_VERSION,
    score: clamped,
    priority,
    qualification_status,
    confidence,
    reasons,
    missing_information: missing,
    scored_at: now.toISOString(),
  }
}

/** Exported for tests and for the "why this score" panel in the UI. */
export const _internals = { parseBudget, classifyIndustry }
