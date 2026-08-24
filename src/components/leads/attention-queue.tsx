/**
 * The work queue: leads that need a person right now.
 *
 * Sorted by first-touch deadline rather than by score, which is the one
 * ordering decision in this build that is worth arguing about. A slightly worse
 * lead that is about to breach its SLA is more urgent than a better one with an
 * hour left, because the better lead will still be there in an hour — the case
 * study is about response time, not about ranking.
 */

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import {
  PriorityBadge,
  QualificationBadge,
  ScoreBadge,
  SlaBadge,
} from "@/components/leads/badges"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { LeadSummary } from "@/lib/contracts/leads"
import { formatTimestamp, leadTitle, relativeTime } from "@/lib/leads/display"

export function AttentionQueue({ leads }: { leads: LeadSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs a rep now</CardTitle>
        <CardDescription>
          Untouched leads, most urgent deadline first.
        </CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/leads?sla_state=pending">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {leads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <p className="font-medium">Every lead has had a first response.</p>
            <p className="text-muted-foreground text-sm">
              Nothing is sitting untouched — which is the whole point.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {leadTitle(lead)}
                  </Link>
                  <span
                    className="text-muted-foreground text-xs"
                    title={formatTimestamp(lead.first_touch_due_at)}
                  >
                    First touch due {relativeTime(lead.first_touch_due_at)}
                    {lead.owner ? ` · ${lead.owner}` : " · unassigned"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ScoreBadge score={lead.score} priority={lead.priority} />
                  <PriorityBadge priority={lead.priority} />
                  <QualificationBadge status={lead.qualification_status} />
                  <SlaBadge state={lead.sla_state} />
                  <Button asChild variant="ghost" size="icon">
                    <Link
                      href={`/leads/${lead.id}`}
                      aria-label={`Open ${leadTitle(lead)}`}
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
