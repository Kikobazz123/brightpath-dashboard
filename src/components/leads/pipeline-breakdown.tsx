/**
 * Where the pipeline actually sits, by priority and by stage.
 *
 * Bars rather than a pie or a trend line: these are proportions of a set that
 * is small enough to count, and a trend line would need history this build does
 * not have. Drawing one from a single snapshot would be inventing a shape.
 *
 * Every row links into the filtered list, so a number is a way in rather than
 * something to look at.
 */

import Link from "next/link"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  LEAD_STATUSES,
  PRIORITIES,
  type PipelineStats,
} from "@/lib/contracts/leads"
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  toneClass,
} from "@/lib/leads/display"

const BAR_FILL = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  positive: "bg-emerald-500",
  info: "bg-blue-500",
  neutral: "bg-muted-foreground/40",
} as const

export function PipelineBreakdown({ stats }: { stats: PipelineStats }) {
  const scored = PRIORITIES.reduce(
    (sum, priority) => sum + (stats.by_priority[priority] ?? 0),
    0,
  )

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>By priority</CardTitle>
          <CardDescription>
            {scored} of {stats.total} leads carry a published score.
            {stats.needs_review > 0
              ? ` ${stats.needs_review} were withheld for review.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {PRIORITIES.map((priority) => (
            <BreakdownRow
              key={priority}
              label={PRIORITY_LABEL[priority]}
              value={stats.by_priority[priority] ?? 0}
              total={scored}
              tone={PRIORITY_TONE[priority]}
              href={`/leads?priority=${priority}`}
            />
          ))}
          {scored === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing scored yet.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By sales status</CardTitle>
          <CardDescription>
            Human-set. The assistant never moves a lead through these.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {LEAD_STATUSES.filter(
            (status) => (stats.by_status[status] ?? 0) > 0,
          ).map((status) => (
            <BreakdownRow
              key={status}
              label={STATUS_LABEL[status]}
              value={stats.by_status[status] ?? 0}
              total={stats.total}
              tone={STATUS_TONE[status]}
              href={`/leads?status=${status}`}
            />
          ))}
          {stats.total === 0 ? (
            <p className="text-muted-foreground text-sm">No leads yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  total,
  tone,
  href,
}: {
  label: string
  value: number
  total: number
  tone: keyof typeof BAR_FILL
  href: string
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <Link href={href} className="group flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="group-hover:underline">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value}
          <span className="ml-1.5 text-xs">({percent}%)</span>
        </span>
      </div>
      <div className={"h-2 w-full overflow-hidden rounded-full " + toneClass("neutral")}>
        <div
          className={"h-full rounded-full transition-all " + BAR_FILL[tone]}
          style={{ width: `${percent}%` }}
        />
      </div>
    </Link>
  )
}
