import {
  type Evidence,
  type NextAction,
  type NextActionType,
  type ScoreResult,
} from "@/lib/contracts/leads"

import { BUDGET_NONE_VALUE, slaMinutes } from "./rubric"

/**
 * Next-Action Advisor.
 *
 * Deliberately deterministic. Choosing between "call now" and "send more
 * information" is a routing decision with a small, enumerable set of outcomes —
 * a rule handles it perfectly, costs nothing, and gives the same answer twice.
 * Handing that to a model would add latency and variance in exchange for
 * nothing, and would make "why was I told to call?" unanswerable.
 *
 * The rationale is assembled from the actual scoring reasons, so it cites the
 * same evidence the score did rather than restating the recommendation.
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export interface AdviseOptions {
  now?: Date
  /** Present when the lead has already been touched — changes the advice. */
  firstTouchAt?: Date | null
}

function topPositive(assessment: ScoreResult): string | null {
  const best = [...assessment.reasons]
    .filter((r) => r.direction === "positive")
    .sort((a, b) => b.points_awarded - a.points_awarded)[0]
  return best?.explanation ?? null
}

function worstNegative(assessment: ScoreResult): string | null {
  const worst = [...assessment.reasons]
    .filter((r) => r.direction === "negative")
    .sort(
      (a, b) =>
        b.points_possible - b.points_awarded - (a.points_possible - a.points_awarded),
    )[0]
  return worst?.explanation ?? null
}

/**
 * Decide the single next step.
 *
 * One action, not a menu. A rep with a list of five suggestions does none of
 * them; the point of this system is to remove a decision, not add one.
 */
export function adviseNextAction(
  assessment: ScoreResult,
  evidence: Evidence,
  options: AdviseOptions = {},
): NextAction {
  const now = options.now ?? new Date()
  const iso = (d: Date) => d.toISOString()

  let action: NextActionType
  let rationale: string
  let due: Date | null

  if (assessment.qualification_status === "NEEDS_REVIEW") {
    /**
     * The gap itself is the next action. Asking one question is cheaper than
     * guessing, and it converts an unscoreable lead into a scoreable one.
     */
    const gaps = assessment.missing_information
    action = "request_information"
    due = new Date(now.getTime() + 2 * HOUR)
    rationale =
      gaps.length > 0
        ? `Cannot qualify yet: ${gaps.join(" and ")} ${
            gaps.length > 1 ? "were" : "was"
          } not stated. Ask directly rather than assuming — one reply makes this scoreable.`
        : "Evidence is too thin to score confidently. Confirm the basics before investing rep time."
  } else if (assessment.priority === "HIGH") {
    /**
     * Speed is the entire thesis for high-priority leads: contact inside the
     * SLA window is worth far more than a better-crafted message sent tomorrow.
     */
    action = "call_now"
    due = new Date(now.getTime() + slaMinutes() * 60 * 1000)
    rationale = `High-priority lead scoring ${assessment.score}/100. ${
      topPositive(assessment) ?? "Strong fit across the qualification criteria."
    } Call within the ${slaMinutes()}-minute window — response speed is the single biggest lever on conversion here.`
  } else if (assessment.priority === "MEDIUM") {
    const blocker = worstNegative(assessment)
    action = "schedule_call"
    due = new Date(now.getTime() + DAY)
    rationale = `Qualified at ${assessment.score}/100 but not top of the queue. ${
      blocker ?? "Fit is partial."
    } Book a short call rather than dropping everything.`
  } else if (assessment.qualification_status === "NOT_QUALIFIED") {
    /**
     * Read the fact, not the prose. Matching on explanation text would break
     * the moment someone rewords a rubric line.
     */
    const budgetItem = evidence.items.find((i) => i.signal === "budget")
    const hasNoBudget =
      budgetItem?.present === true &&
      budgetItem.value?.trim().toLowerCase() === BUDGET_NONE_VALUE

    if (hasNoBudget) {
      action = "disqualify"
      due = null
      rationale =
        "Stated outright that no budget exists. Close it out rather than spending rep time — this is a real answer, not a soft no."
    } else {
      action = "nurture"
      due = new Date(now.getTime() + 30 * DAY)
      rationale = `Scored ${assessment.score}/100. ${
        worstNegative(assessment) ?? "Weak fit against the criteria."
      } Keep warm on the mailing list; revisit in a month.`
    }
  } else {
    action = "send_information"
    due = new Date(now.getTime() + DAY)
    rationale = "Send relevant material and see whether engagement develops."
  }

  /**
   * If a rep has already made contact, chasing "call now" again is noise —
   * the useful next step becomes routing it to whoever owns the conversation.
   */
  if (options.firstTouchAt && action === "call_now") {
    action = "route_to_rep"
    rationale = `Already contacted. ${rationale} Hand to the owning rep to continue rather than opening a second thread.`
  }

  return {
    action,
    rationale,
    due_at: due ? iso(due) : null,
    decided_at: iso(now),
  }
}
