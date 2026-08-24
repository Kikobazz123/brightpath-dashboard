/**
 * The headline tiles.
 *
 * Deliberately not vanity metrics. Each tile is one of the failures named in
 * the BrightPath case — a lead sitting untouched, a valuable lead nobody has
 * triaged, an assessment the system honestly could not make — so the numbers
 * are things a sales manager can act on this morning rather than a revenue
 * figure nobody owns.
 *
 * `median_first_touch_minutes` is null until something has actually been
 * touched. It renders as an em dash, never as zero: "no data" and "instant
 * response" are opposite facts and must not share a glyph.
 */

import Link from "next/link"
import { AlertTriangle, Clock, HelpCircle, Users } from "lucide-react"

import { CountUp } from "@/components/motion/count-up"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PipelineStats } from "@/lib/contracts/leads"
import { formatMinutes, toneClass } from "@/lib/leads/display"
import { cn } from "@/lib/utils"

export function PipelineStatCards({ stats }: { stats: PipelineStats }) {
  const high = stats.by_priority.HIGH ?? 0

  const tiles = [
    {
      label: "Leads in pipeline",
      value: String(stats.total),
      icon: Users,
      tone: "neutral" as const,
      href: "/leads",
      footer: `${high} marked high priority`,
      detail: "Every lead captured for this tenant.",
    },
    {
      label: "Awaiting first touch",
      value: String(stats.awaiting_first_touch),
      icon: Clock,
      tone: stats.awaiting_first_touch > 0 ? ("warning" as const) : ("positive" as const),
      href: "/leads?sla_state=pending",
      footer:
        stats.awaiting_first_touch > 0
          ? "Nobody has responded to these yet"
          : "Every lead has had a first response",
      detail: "The gap the assistant exists to close.",
    },
    {
      label: "SLA breached",
      value: String(stats.sla_breached),
      icon: AlertTriangle,
      tone: stats.sla_breached > 0 ? ("critical" as const) : ("positive" as const),
      href: "/leads?sla_state=breached",
      footer:
        stats.sla_breached > 0
          ? "Past the first-touch deadline"
          : "No lead has missed its deadline",
      detail: "Exactly the failure in the case study.",
    },
    {
      label: "Needs human review",
      value: String(stats.needs_review),
      icon: HelpCircle,
      tone: stats.needs_review > 0 ? ("warning" as const) : ("neutral" as const),
      href: "/leads?qualification_status=NEEDS_REVIEW",
      footer: "Evidence too thin to score",
      detail: "Withheld rather than guessed.",
    },
  ]

  return (
    <div className="stagger-in grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="@container/card">
          <CardHeader>
            <CardDescription>{tile.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <CountUp value={tile.value} />
            </CardTitle>
            <CardAction>
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md",
                  toneClass(tile.tone),
                )}
              >
                <tile.icon className="size-4" />
              </span>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <Link
              href={tile.href}
              className="line-clamp-1 font-medium hover:underline"
            >
              {tile.footer}
            </Link>
            <span className="text-muted-foreground">{tile.detail}</span>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

/**
 * The response-time strip.
 *
 * Separate from the tiles because it is a measurement of the team, not of the
 * pipeline — and because it must be able to say "not enough data yet" without
 * that reading as a bad score.
 */
export function ResponseTimeSummary({ stats }: { stats: PipelineStats }) {
  const touched = stats.total - stats.awaiting_first_touch

  return (
    <Card>
      <CardHeader>
        <CardDescription>Speed to first useful sales action</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {formatMinutes(stats.median_first_touch_minutes)}
        </CardTitle>
      </CardHeader>
      <CardFooter className="text-muted-foreground flex-col items-start gap-1.5 text-sm">
        {stats.median_first_touch_minutes === null ? (
          <span>
            No lead has been touched yet, so there is nothing to average. This
            stays blank rather than showing a flattering zero.
          </span>
        ) : (
          <span>
            Median across {touched} touched {touched === 1 ? "lead" : "leads"},
            measured from arrival to the first recorded sales action.
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
