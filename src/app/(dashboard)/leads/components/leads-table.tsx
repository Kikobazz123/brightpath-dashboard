/**
 * The triage list.
 *
 * Column order is the order a rep triages in: who, how hot, is the clock
 * running, has anyone written to them, where does it stand. Score and SLA sit
 * left of the human-owned columns so the machine's opinion and the human's
 * decision stay visually distinct.
 *
 * A Server Component — the rows arrive as HTML with no client-side fetch.
 */

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import {
  FollowUpBadge,
  PriorityBadge,
  QualificationBadge,
  ScoreBadge,
  SlaBadge,
  SourceBadge,
  StatusBadge,
} from "@/components/leads/badges"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LeadSummary, Pagination } from "@/lib/contracts/leads"
import { formatTimestamp, leadTitle, relativeTime } from "@/lib/leads/display"

export function LeadsTable({
  leads,
  pagination,
  query,
}: {
  leads: LeadSummary[]
  pagination: Pagination
  query: Record<string, string>
}) {
  if (leads.length === 0) {
    return <EmptyState filtered={Object.keys(query).length > 0} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Lead</TableHead>
              <TableHead className="w-[70px]">Score</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead>First touch</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="w-[60px] text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="hover:bg-muted/40">
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:underline"
                    >
                      {leadTitle(lead)}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {lead.contact_name ?? "No contact name"}
                      {lead.industry ? ` · ${lead.industry}` : ""}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <SourceBadge source={lead.source} />
                      <span className="text-muted-foreground text-xs">
                        {relativeTime(lead.created_at)}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <ScoreBadge score={lead.score} priority={lead.priority} />
                </TableCell>

                <TableCell>
                  <PriorityBadge priority={lead.priority} />
                </TableCell>

                <TableCell>
                  <QualificationBadge status={lead.qualification_status} />
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-1">
                    <SlaBadge state={lead.sla_state} />
                    <span
                      className="text-muted-foreground text-xs"
                      title={formatTimestamp(
                        lead.first_touch_at ?? lead.first_touch_due_at,
                      )}
                    >
                      {lead.first_touch_at
                        ? `Touched ${relativeTime(lead.first_touch_at)}`
                        : `Due ${relativeTime(lead.first_touch_due_at)}`}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <FollowUpBadge state={lead.follow_up_state} />
                </TableCell>

                <TableCell>
                  <StatusBadge status={lead.status} />
                </TableCell>

                <TableCell>
                  {lead.owner ? (
                    <span className="text-sm">{lead.owner}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Unassigned
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="icon">
                    <Link
                      href={`/leads/${lead.id}`}
                      aria-label={`Open ${leadTitle(lead)}`}
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadsPagination pagination={pagination} query={query} />
    </div>
  )
}

function LeadsPagination({
  pagination,
  query,
}: {
  pagination: Pagination
  query: Record<string, string>
}) {
  const { page, page_size, total, total_pages } = pagination
  if (total === 0) return null

  const href = (target: number) => {
    const params = new URLSearchParams(query)
    if (target <= 1) params.delete("page")
    else params.set("page", String(target))
    const qs = params.toString()
    return qs ? `/leads?${qs}` : "/leads"
  }

  const first = (page - 1) * page_size + 1
  const last = Math.min(page * page_size, total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-sm">
        Showing <span className="tabular-nums">{first}</span>–
        <span className="tabular-nums">{last}</span> of{" "}
        <span className="tabular-nums">{total}</span> leads
      </p>
      <div className="flex items-center gap-2">
        <Button
          asChild={page > 1}
          variant="outline"
          size="sm"
          disabled={page <= 1}
        >
          {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : <span>Previous</span>}
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums">
          Page {page} of {total_pages}
        </span>
        <Button
          asChild={page < total_pages}
          variant="outline"
          size="sm"
          disabled={page >= total_pages}
        >
          {page < total_pages ? (
            <Link href={href(page + 1)}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </div>
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <h3 className="font-medium">
        {filtered ? "No leads match these filters" : "No leads yet"}
      </h3>
      <p className="text-muted-foreground max-w-sm text-sm">
        {filtered
          ? "Clear a filter to widen the search."
          : "Capture a lead to see the assistant qualify, score and draft a reply for it."}
      </p>
      {filtered ? (
        <Button asChild variant="outline" size="sm">
          <Link href="/leads">Clear filters</Link>
        </Button>
      ) : (
        <Button asChild size="sm">
          <Link href="/leads/new">Capture a lead</Link>
        </Button>
      )}
    </div>
  )
}
