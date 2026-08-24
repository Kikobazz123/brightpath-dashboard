/**
 * The lead as it actually arrived.
 *
 * `raw_context` is kept verbatim and shown here so extraction can be audited
 * against the original at any time — if the analyst reads something into the
 * text that is not there, this card is where that becomes obvious.
 *
 * The structured fields above it are what a rep typed or a form posted. They
 * are shown as *given*, distinct from the evidence panel, which is what the
 * assistant inferred and quoted.
 */

import { Mail, Phone } from "lucide-react"

import { SlaBadge, SourceBadge } from "@/components/leads/badges"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Lead } from "@/lib/contracts/leads"
import { formatTimestamp, relativeTime } from "@/lib/leads/display"

export function LeadOverview({ lead }: { lead: Lead }) {
  const facts: { label: string; value: string | null }[] = [
    { label: "Company", value: lead.company },
    { label: "Industry", value: lead.industry },
    {
      label: "Company size",
      value: lead.company_size ? `${lead.company_size} employees` : null,
    },
    { label: "Budget", value: lead.budget },
    { label: "Interest", value: lead.interest_level },
    { label: "Stated need", value: lead.need },
    { label: "Contact role", value: lead.contact.role },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead record</CardTitle>
        <CardDescription>
          Captured {formatTimestamp(lead.created_at)} (
          {relativeTime(lead.created_at)})
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={lead.source} />
          <SlaBadge state={lead.sla_state} />
        </div>

        {lead.contact.email || lead.contact.phone ? (
          <div className="flex flex-col gap-2">
            {lead.contact.email ? (
              <a
                href={`mailto:${lead.contact.email}`}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <Mail className="text-muted-foreground size-4 shrink-0" />
                {lead.contact.email}
              </a>
            ) : null}
            {lead.contact.phone ? (
              <a
                href={`tel:${lead.contact.phone}`}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <Phone className="text-muted-foreground size-4 shrink-0" />
                {lead.contact.phone}
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No email or phone on this lead — a next action of &ldquo;request
            information&rdquo; is the realistic one.
          </p>
        )}

        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                {fact.label}
              </dt>
              <dd className="text-sm">
                {fact.value ?? (
                  <span className="text-muted-foreground">Not given</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2 border-t pt-4">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            What arrived, verbatim
          </span>
          <div className="bg-muted/40 max-h-72 overflow-y-auto rounded-lg border p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {lead.raw_context || "No text was supplied with this lead."}
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            Kept unedited so extraction can be re-run and checked against the
            source.
          </p>
        </div>

        <div className="flex flex-col gap-1 border-t pt-4 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">First touch due</span>
            <span className="tabular-nums">
              {formatTimestamp(lead.first_touch_due_at)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">First touch</span>
            <span className="tabular-nums">
              {lead.first_touch_at
                ? formatTimestamp(lead.first_touch_at)
                : "Not yet"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Lead id</span>
            <span className="font-mono break-all">{lead.id}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
