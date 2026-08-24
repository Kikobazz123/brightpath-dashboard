/**
 * Leads — the triage queue.
 *
 * A Server Component. Filters live in the URL, are validated by the same Zod
 * schema the HTTP route uses, and are passed straight to the service layer, so
 * `/leads?priority=HIGH` and `GET /api/v1/leads?priority=HIGH` cannot disagree.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { PipelineStatCards } from "@/components/leads/pipeline-stats"
import { Button } from "@/components/ui/button"
import { listLeadsQuerySchema } from "@/lib/contracts/leads"
import { fetchLeads, fetchStats } from "@/lib/client/server-data"

import { LeadsFilters } from "./components/leads-filters"
import { LeadsTable } from "./components/leads-table"

export const metadata: Metadata = {
  title: "Leads",
  description:
    "Every lead BrightPath has captured, with its score, priority and follow-up state.",
}

/** Live data — a cached triage queue is a queue that hides a breached SLA. */
export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const raw = await searchParams

  // Flatten `?priority=HIGH&priority=LOW` to the first value; the query schema
  // is single-valued and a silently-ignored second value would be worse.
  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single !== undefined && single !== "") flat[key] = single
  }

  // An unparseable filter falls back to defaults rather than throwing — a bad
  // bookmark should show the unfiltered list, not an error page.
  const parsed = listLeadsQuerySchema.safeParse(flat)
  const query = parsed.success ? parsed.data : listLeadsQuerySchema.parse({})

  const [stats, { leads, pagination }] = await Promise.all([
    fetchStats(),
    fetchLeads(query),
  ])

  return (
    <>
      <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Captured, qualified and scored against BrightPath&apos;s rubric. The
            assistant proposes; you decide.
          </p>
        </div>
        <Button asChild>
          <Link href="/leads/new">
            <Plus className="size-4" />
            Capture lead
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PipelineStatCards stats={stats} />
        <LeadsFilters />
        <LeadsTable leads={leads} pagination={pagination} query={flat} />
      </div>
    </>
  )
}
