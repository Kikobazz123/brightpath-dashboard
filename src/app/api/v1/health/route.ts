import { observe } from "@/lib/api/observability"
import { activeProvider } from "@/lib/ai/provider"
import { getDb } from "@/lib/db"
import { _sql } from "@/lib/leads/service"

/**
 * Is this deployment actually working?
 *
 * Unauthenticated and intentionally boring: it reports whether the database
 * answers and which AI provider is configured, and nothing about any lead. A
 * health endpoint that needs a token cannot be used by the uptime checker that
 * needs it most, and one that leaks data is a much worse trade.
 *
 * Two states are distinguished, because conflating them is how a deployment
 * looks fine while doing nothing useful:
 *
 *   degraded — the app runs but AI_PROVIDER is "stub", so no lead will be
 *              analysed or drafted. A 200, because it is serving.
 *   unhealthy — the database is unreachable. Nothing works; 503.
 */
async function health() {
  const started = Date.now()

  let database: "ok" | "unreachable" = "unreachable"
  let databaseMs: number | null = null

  try {
    const dbStarted = Date.now()
    await getDb().execute(_sql`select 1`)
    databaseMs = Date.now() - dbStarted
    database = "ok"
  } catch (error) {
    // The message can contain the connection string. Log the class, not the text.
    console.error(
      "[health] database unreachable:",
      error instanceof Error ? error.name : "unknown error",
    )
  }

  const provider = activeProvider()
  const status =
    database !== "ok" ? "unhealthy" : provider === "stub" ? "degraded" : "ok"

  return Response.json(
    {
      ok: status !== "unhealthy",
      data: {
        status,
        checks: {
          database,
          database_ms: databaseMs,
          ai_provider: provider,
          ai_configured: provider !== "stub",
        },
        notes:
          provider === "stub"
            ? ["AI_PROVIDER is \"stub\": leads will not be analysed or drafted."]
            : [],
        duration_ms: Date.now() - started,
      },
    },
    { status: status === "unhealthy" ? 503 : 200 },
  )
}

export const GET = observe("GET /api/v1/health", health)

export const dynamic = "force-dynamic"
