/**
 * The sales-floor view.
 *
 * Everything here is read from the database. The template's demo revenue chart
 * and sample task table were removed rather than restyled: the brief is
 * explicit that the system must not invent performance numbers, and a chart of
 * fabricated conversions on the front page is exactly the claim it warns
 * against. What is left is smaller and true.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { AttentionQueue } from "@/components/leads/attention-queue"
import { PipelineBreakdown } from "@/components/leads/pipeline-breakdown"
import {
  PipelineStatCards,
  ResponseTimeSummary,
} from "@/components/leads/pipeline-stats"
import { Button } from "@/components/ui/button"
import { fetchLeads, fetchStats } from "@/lib/client/server-data"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Pipeline health, speed to first response, and the leads waiting on a rep.",
}

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [stats, pending] = await Promise.all([
    fetchStats(),
    // Untouched leads, soonest deadline first — the actual work queue.
    fetchLeads({
      sla_state: "pending",
      sort: "first_touch_due_at",
      order: "asc",
      page_size: 6,
    }),
  ])

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Sales pipeline</h1>
          <p className="text-muted-foreground">
            Where every lead stands, and which ones are running out of time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/leads">All leads</Link>
          </Button>
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="size-4" />
              Capture lead
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PipelineStatCards stats={stats} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AttentionQueue leads={pending.leads} />
          </div>
          <ResponseTimeSummary stats={stats} />
        </div>

        <PipelineBreakdown stats={stats} />
      </div>
    </>
  )
}
