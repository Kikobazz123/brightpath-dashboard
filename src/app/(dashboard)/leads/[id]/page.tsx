/**
 * One lead, end to end.
 *
 * The page is laid out as the judge journey reads: what arrived, what the
 * assistant found, what it scored and why, what it wrote, what it recommends,
 * and then — in its own column, visually separated — what the human decided.
 *
 * A Server Component. Every panel receives already-loaded data; the only client
 * code is the four interactive controls.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import {
  FollowUpBadge,
  PriorityBadge,
  QualificationBadge,
  ScoreBadge,
  SlaBadge,
  StatusBadge,
} from "@/components/leads/badges"
import { Button } from "@/components/ui/button"
import { fetchActivity, fetchLeadOrNull } from "@/lib/client/server-data"
import { leadTitle } from "@/lib/leads/display"

import { ActivityTimeline } from "./components/activity-timeline"
import { DispositionControl } from "./components/disposition-control"
import { EvidencePanel } from "./components/evidence-panel"
import { FollowUpPanel } from "./components/follow-up-panel"
import { LeadOverview } from "./components/lead-overview"
import { NextActionPanel } from "./components/next-action-panel"
import { PipelineActions } from "./components/pipeline-actions"
import { ScorePanel } from "./components/score-panel"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const lead = await fetchLeadOrNull(id)

  if (!lead) return { title: "Lead not found" }
  return {
    title: leadTitle(lead),
    description: `Qualification, score and follow-up for ${leadTitle(lead)}.`,
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // A malformed id is a 404, not a 500 — the service validates the uuid and a
  // pasted-wrong link should land on the not-found page like any bad URL.
  const lead = await fetchLeadOrNull(id).catch(() => null)
  if (!lead) notFound()

  const activity = await fetchActivity(lead.id).catch(() => [])

  return (
    <>
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2 w-fit"
        >
          <Link href="/leads">
            <ArrowLeft className="size-4" />
            Back to leads
          </Link>
        </Button>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {leadTitle(lead)}
            </h1>
            <ScoreBadge
              score={lead.assessment?.score ?? null}
              priority={lead.assessment?.priority ?? null}
              className="text-base"
            />
          </div>

          <p className="text-muted-foreground">
            {lead.contact.name ?? "No contact name"}
            {lead.contact.role ? ` · ${lead.contact.role}` : ""}
            {lead.industry ? ` · ${lead.industry}` : ""}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={lead.assessment?.priority ?? null} />
            <QualificationBadge
              status={lead.assessment?.qualification_status ?? "NOT_ASSESSED"}
            />
            <StatusBadge status={lead.status} />
            <SlaBadge state={lead.sla_state} />
            <FollowUpBadge state={lead.follow_up_state} />
          </div>
        </div>

        <PipelineActions lead={lead} />
      </div>

      <div className="grid gap-6 px-4 lg:grid-cols-3 lg:px-6">
        {/* What the assistant produced. */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <ScorePanel assessment={lead.assessment} />
          <EvidencePanel evidence={lead.evidence} />
          <FollowUpPanel
            leadId={lead.id}
            draft={lead.follow_up}
            state={lead.follow_up_state}
            contactEmail={lead.contact.email}
          />
          <NextActionPanel action={lead.next_action} />
        </div>

        {/* What arrived, and what the human decided about it. */}
        <div className="flex flex-col gap-6">
          <DispositionControl
            leadId={lead.id}
            status={lead.status}
            owner={lead.owner}
          />
          <LeadOverview lead={lead} />
          <ActivityTimeline activity={activity} />
        </div>
      </div>
    </>
  )
}
