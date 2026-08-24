/**
 * The score, and why.
 *
 * The brief demands an explainable score, so the number is never shown alone:
 * every signal contributes a visible points-out-of-possible line with the
 * rubric's own wording attached. Nothing here is model prose — the explanations
 * come from `rubric.ts`, which is why the same evidence produces the same
 * sentence every run.
 *
 * When the status is NEEDS_REVIEW there is no number at all, and the panel says
 * what is missing instead. That is the honest output, and it is the one the
 * case study specifically asks for.
 */

import { AlertTriangle, Minus, TrendingDown, TrendingUp } from "lucide-react"

import { PriorityBadge, QualificationBadge } from "@/components/leads/badges"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { ScoreResult } from "@/lib/contracts/leads"
import {
  QUALIFICATION_MEANING,
  SIGNAL_LABEL,
  formatConfidence,
  formatTimestamp,
  toneClass,
} from "@/lib/leads/display"

const DIRECTION_ICON = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
} as const

const DIRECTION_TONE = {
  positive: "positive",
  negative: "critical",
  neutral: "neutral",
} as const

export function ScorePanel({ assessment }: { assessment: ScoreResult | null }) {
  if (!assessment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score</CardTitle>
          <CardDescription>
            Not assessed yet. The score is computed from extracted evidence by
            deterministic code, not produced by the model.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const withheld = assessment.score === null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span>Score</span>
          {withheld ? (
            <span className="text-muted-foreground text-2xl font-semibold tabular-nums">
              —
            </span>
          ) : (
            <span className="text-3xl font-semibold tabular-nums">
              {assessment.score}
              <span className="text-muted-foreground text-base font-normal">
                /100
              </span>
            </span>
          )}
          <PriorityBadge priority={assessment.priority} />
          <QualificationBadge status={assessment.qualification_status} />
        </CardTitle>
        <CardDescription>
          {QUALIFICATION_MEANING[assessment.qualification_status]} Scored{" "}
          {formatTimestamp(assessment.scored_at)} against rubric{" "}
          <span className="font-mono text-xs">{assessment.rubric_version}</span>.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {withheld ? (
          <div
            className={
              "flex items-start gap-3 rounded-lg p-3 " + toneClass("warning")
            }
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">No score published</span>
              <span>
                The rubric requires evidence for every signal listed below before
                it will publish a number. Withholding it is deliberate — a
                confident score built on absent evidence is worse than no score.
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Evidence coverage
            </span>
            <span className="font-medium tabular-nums">
              {formatConfidence(assessment.confidence)}
            </span>
          </div>
          <Progress value={assessment.confidence * 100} />
          <p className="text-muted-foreground text-xs">
            The share of qualification signals backed by a real quote from the
            lead. Low coverage lowers confidence rather than being filled in.
          </p>
        </div>

        {assessment.missing_information.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Missing information</span>
            <div className="flex flex-wrap gap-1.5">
              {assessment.missing_information.map((signal) => (
                <Badge key={signal} className={toneClass("warning")}>
                  {SIGNAL_LABEL[signal]}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Ask for these before treating the assessment as settled.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">How the score was reached</span>
          <div className="flex flex-col gap-2">
            {assessment.reasons.map((reason) => {
              const Icon = DIRECTION_ICON[reason.direction]
              return (
                <div
                  key={reason.signal}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <span
                    className={
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full " +
                      toneClass(DIRECTION_TONE[reason.direction])
                    }
                  >
                    <Icon className="size-3" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        {SIGNAL_LABEL[reason.signal]}
                      </span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {reason.points_awarded} / {reason.points_possible} pts
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {reason.explanation}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
