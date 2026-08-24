/**
 * The vocabulary of the leads UI, as badges.
 *
 * No hooks and no client directive, so these render inside Server Components
 * and can equally be dropped into a Client Component without pulling anything
 * extra to the browser.
 */

import { AlertTriangle, Clock, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  FOLLOW_UP_LABEL,
  FOLLOW_UP_TONE,
  NEXT_ACTION_LABEL,
  NEXT_ACTION_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  QUALIFICATION_LABEL,
  QUALIFICATION_TONE,
  SLA_LABEL,
  SLA_TONE,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  toneClass,
} from "@/lib/leads/display"
import type {
  FollowUpState,
  LeadSource,
  LeadStatus,
  NextActionType,
  Priority,
  QualificationStatus,
  SlaState,
} from "@/lib/contracts/leads"
import { cn } from "@/lib/utils"

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority | null
  className?: string
}) {
  if (!priority) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        No priority
      </Badge>
    )
  }
  return (
    <Badge className={cn(toneClass(PRIORITY_TONE[priority]), className)}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  )
}

export function QualificationBadge({
  status,
  className,
}: {
  status: QualificationStatus
  className?: string
}) {
  return (
    <Badge className={cn(toneClass(QUALIFICATION_TONE[status]), className)}>
      {status === "NEEDS_REVIEW" ? <AlertTriangle /> : null}
      {QUALIFICATION_LABEL[status]}
    </Badge>
  )
}

export function StatusBadge({
  status,
  className,
}: {
  status: LeadStatus
  className?: string
}) {
  return (
    <Badge className={cn(toneClass(STATUS_TONE[status]), className)}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

export function FollowUpBadge({
  state,
  className,
}: {
  state: FollowUpState
  className?: string
}) {
  return (
    <Badge className={cn(toneClass(FOLLOW_UP_TONE[state]), className)}>
      {state === "sent" ? <ShieldCheck /> : null}
      {FOLLOW_UP_LABEL[state]}
    </Badge>
  )
}

export function SlaBadge({
  state,
  className,
}: {
  state: SlaState
  className?: string
}) {
  return (
    <Badge className={cn(toneClass(SLA_TONE[state]), className)}>
      {state === "breached" ? <AlertTriangle /> : <Clock />}
      {SLA_LABEL[state]}
    </Badge>
  )
}

export function NextActionBadge({
  action,
  className,
}: {
  action: NextActionType
  className?: string
}) {
  return (
    <Badge className={cn(toneClass(NEXT_ACTION_TONE[action]), className)}>
      {NEXT_ACTION_LABEL[action]}
    </Badge>
  )
}

export function SourceBadge({
  source,
  className,
}: {
  source: LeadSource
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("text-muted-foreground", className)}>
      {SOURCE_LABEL[source]}
    </Badge>
  )
}

/**
 * The score, or an honest blank.
 *
 * A withheld score renders as an em dash with the reason beside it rather than
 * a zero. Zero is a judgement; blank is the absence of one, and the rubric is
 * explicit that those are different outcomes.
 */
export function ScoreBadge({
  score,
  priority,
  className,
}: {
  score: number | null
  priority: Priority | null
  className?: string
}) {
  if (score === null) {
    return (
      <span
        className={cn("text-muted-foreground tabular-nums", className)}
        title="No score was published — see the qualification status."
      >
        —
      </span>
    )
  }

  const tone = priority ? PRIORITY_TONE[priority] : "neutral"
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums",
        toneClass(tone),
        className,
      )}
    >
      {score}
    </span>
  )
}
