/**
 * Read accessors for React Server Components.
 *
 * The dashboard runs on the same server as the API, so a page that fetched
 * `/api/v1/leads` over HTTP would serialize, send, and re-parse its own data
 * for no reason — and would need a bearer token in the browser to do it. These
 * functions call the service layer directly instead: no network hop, no token,
 * no envelope to unwrap. The HTTP API stays exactly as it is, for the callers
 * that genuinely are remote (the public capture form, webhooks, external CRMs).
 *
 * Server Components only. Mutations live in `./actions`.
 */

import { cache } from "react"

import type {
  Activity,
  Lead,
  LeadSource,
  LeadSummary,
  ListLeadsQuery,
  Pagination,
  PipelineStats,
} from "@/lib/contracts/leads"
import { listLeadsQuerySchema } from "@/lib/contracts/leads"
import {
  NotFoundError,
  getActivity,
  getLead,
  getStats,
  listLeadMessages,
  listLeads,
} from "@/lib/leads/service"

/**
 * The tenant every query is scoped to.
 *
 * Single-tenant for the demo, but resolved in one place so that swapping in
 * real sessions later is a change here and nowhere else — the same boundary
 * `authenticate()` enforces for HTTP callers.
 */
export function tenantId(): string {
  return process.env.DEMO_TENANT_ID?.trim() || "brightpath"
}

/**
 * Headline tiles. `cache` dedupes within a single render, so a layout and the
 * page inside it can both ask for stats and the database is queried once.
 */
export const fetchStats = cache(async (): Promise<PipelineStats> => {
  return getStats(tenantId())
})

/** Keyed on the serialized query so `cache` can actually dedupe object args. */
const fetchLeadsCached = cache(
  async (
    queryJson: string,
  ): Promise<{ leads: LeadSummary[]; pagination: Pagination }> => {
    const query = listLeadsQuerySchema.parse(JSON.parse(queryJson))
    const { leads, total } = await listLeads(tenantId(), query)

    return {
      leads,
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.max(1, Math.ceil(total / query.page_size)),
      },
    }
  },
)

/**
 * Table rows plus pagination. Pass whatever subset of the query you have —
 * defaults come from the same schema the HTTP route validates against, so a
 * page and an API caller asking for "the first page" get identical results.
 */
export function fetchLeads(
  query: Partial<ListLeadsQuery> = {},
): Promise<{ leads: LeadSummary[]; pagination: Pagination }> {
  return fetchLeadsCached(JSON.stringify(query))
}

/** Throws `NotFoundError` — pair with `notFound()` in a route segment. */
export const fetchLead = cache(async (id: string): Promise<Lead> => {
  return getLead(tenantId(), id)
})

/** Null instead of a throw, for pages that render their own empty state. */
export async function fetchLeadOrNull(id: string): Promise<Lead | null> {
  try {
    return await fetchLead(id)
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

/** The audit trail, oldest first — what a timeline component renders. */
export const fetchActivity = cache(async (id: string): Promise<Activity[]> => {
  return getActivity(tenantId(), id)
})

/**
 * Everything that arrived, newest first — the Inbox.
 *
 * Full leads rather than summaries, because the message body is the point of
 * the view. Capped, because an inbox is a place you scan rather than paginate.
 */
export const fetchInbox = cache(
  async (sourcesJson = "[]"): Promise<Lead[]> => {
    const sources = JSON.parse(sourcesJson) as LeadSource[]
    return listLeadMessages(tenantId(), {
      sources: sources.length ? sources : undefined,
      limit: 100,
    })
  },
)
