/**
 * What the assistant found, and where it found it.
 *
 * Every present signal shows the verbatim sentence it came from. That quote is
 * the whole guarantee: a rep can check the claim against the lead's own words
 * in one glance, which is what stops a plausible-sounding extraction from
 * quietly becoming a fact. A signal with no quote is rendered as "not stated",
 * never as a reasonable-looking assumption.
 */

import { AlertCircle, Check, Minus } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SIGNALS, type Evidence } from "@/lib/contracts/leads"
import {
  SIGNAL_DESCRIPTION,
  SIGNAL_LABEL,
  formatConfidence,
  formatTimestamp,
  toneClass,
} from "@/lib/leads/display"

export function EvidencePanel({ evidence }: { evidence: Evidence | null }) {
  if (!evidence) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>
            Nothing extracted yet. Run the assistant and every signal below will
            arrive with the sentence it was drawn from.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Render in rubric order, not extraction order, so the list reads the same on
  // every lead and a missing signal is a visible gap in a familiar sequence.
  const bySignal = new Map(evidence.items.map((item) => [item.signal, item]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence</CardTitle>
        <CardDescription>
          Extracted {formatTimestamp(evidence.extracted_at)} by{" "}
          <span className="font-mono text-xs">{evidence.model}</span>. Each
          finding cites the lead&apos;s own words.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {SIGNALS.map((signal) => {
          const item = bySignal.get(signal)
          const present = item?.present ?? false

          return (
            <div
              key={signal}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "inline-flex size-5 items-center justify-center rounded-full " +
                      toneClass(present ? "positive" : "neutral")
                    }
                  >
                    {present ? (
                      <Check className="size-3" />
                    ) : (
                      <Minus className="size-3" />
                    )}
                  </span>
                  <span className="font-medium">{SIGNAL_LABEL[signal]}</span>
                </div>

                {item ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {formatConfidence(item.confidence)} confidence
                  </Badge>
                ) : null}
              </div>

              {present && item?.value ? (
                <p className="text-sm font-medium">{item.value}</p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Not stated — {SIGNAL_DESCRIPTION[signal].toLowerCase()}
                </p>
              )}

              {item?.source_span ? (
                <blockquote className="border-muted-foreground/30 text-muted-foreground border-l-2 pl-3 text-sm italic">
                  &ldquo;{item.source_span}&rdquo;
                </blockquote>
              ) : null}

              {item?.note ? (
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                  <AlertCircle className="mt-0.5 size-3 shrink-0" />
                  {item.note}
                </p>
              ) : null}
            </div>
          )
        })}

        {evidence.context_notes.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <span className="text-sm font-medium">Other context</span>
            <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-sm">
              {evidence.context_notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
