/**
 * One recommended next step.
 *
 * Exactly one, by design. A list of five things a rep could do is the same
 * problem the case study describes — time spent deciding instead of selling —
 * so the advisor commits to a single action and explains why that one.
 *
 * It is a recommendation, not an instruction: the status control beside it is
 * where the human records what they actually did.
 */

import { CalendarClock } from "lucide-react"

import { NextActionBadge } from "@/components/leads/badges"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { NextAction } from "@/lib/contracts/leads"
import { formatTimestamp, relativeTime } from "@/lib/leads/display"

export function NextActionPanel({ action }: { action: NextAction | null }) {
  if (!action) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Next action</CardTitle>
          <CardDescription>
            No recommendation yet. The advisor reads the score and the evidence
            gaps, so it runs after scoring.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const overdue =
    action.due_at !== null && new Date(action.due_at).getTime() < Date.now()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span>Next action</span>
          <NextActionBadge action={action.action} />
        </CardTitle>
        <CardDescription>
          Recommended {formatTimestamp(action.decided_at)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed">{action.rationale}</p>

        {action.due_at ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 shrink-0" />
            <span>
              Suggested by {formatTimestamp(action.due_at)}
              <span className={overdue ? "text-destructive font-medium" : ""}>
                {" "}
                ({relativeTime(action.due_at)})
              </span>
            </span>
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 shrink-0" />
            <span>No deadline attached — act when you pick the lead up.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
