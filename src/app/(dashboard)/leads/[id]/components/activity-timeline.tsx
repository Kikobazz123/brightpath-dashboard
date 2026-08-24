/**
 * The audit trail.
 *
 * Oldest first, because this is read as a story: when the lead arrived, how
 * long it sat, who touched it. It doubles as the evidence behind the SLA
 * numbers on the dashboard — a breach is not an opinion, it is a gap between
 * two rows here.
 *
 * `actor` is always shown and never abbreviated. "system", "ai:analyst" and
 * "rep" being visually identical is how a team stops noticing which decisions
 * a machine made.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Activity } from "@/lib/contracts/leads"
import {
  ACTIVITY_LABEL,
  ACTIVITY_TONE,
  formatTimestamp,
  relativeTime,
  toneClass,
} from "@/lib/leads/display"

export function ActivityTimeline({ activity }: { activity: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
        <CardDescription>
          Every state change, with who made it. {activity.length}{" "}
          {activity.length === 1 ? "entry" : "entries"}.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {activity.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing recorded yet.</p>
        ) : (
          <ol className="flex flex-col">
            {activity.map((entry, index) => (
              <li key={entry.id} className="flex gap-3">
                {/* Rail: dot plus the connector to the next entry. */}
                <div className="flex flex-col items-center">
                  <span
                    className={
                      "mt-1.5 size-2.5 shrink-0 rounded-full " +
                      toneClass(ACTIVITY_TONE[entry.type])
                    }
                  />
                  {index < activity.length - 1 ? (
                    <span className="bg-border w-px flex-1" />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {ACTIVITY_LABEL[entry.type]}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {entry.actor}
                    </Badge>
                  </div>

                  <span
                    className="text-muted-foreground text-xs"
                    title={relativeTime(entry.timestamp)}
                  >
                    {formatTimestamp(entry.timestamp)}
                  </span>

                  <ActivityDetail payload={entry.payload} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Payloads are `Record<string, unknown>` by contract, so this renders whatever
 * a given activity type happened to record rather than switching on the type.
 * A new activity type shows its detail without this component being touched.
 */
function ActivityDetail({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  )
  if (entries.length === 0) return null

  return (
    <dl className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1.5">
          <dt className="font-medium">{key.replace(/_/g, " ")}:</dt>
          <dd className="font-mono break-all">{render(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function render(value: unknown): string {
  if (Array.isArray(value)) return value.map(render).join(", ")
  if (typeof value === "object" && value !== null) return JSON.stringify(value)
  return String(value)
}
