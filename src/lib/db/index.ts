import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "./schema"

/**
 * Database handle.
 *
 * Reads DATABASE_URL lazily rather than at module load, so importing anything
 * from this file in a context without the env var (a unit test of the scoring
 * rubric, for instance) doesn't blow up. The scoring logic is pure and should
 * never need a database to be tested.
 */

let cached: ReturnType<typeof createClient> | null = null

function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add the Neon connection string.",
    )
  }
  return drizzle(neon(url), { schema })
}

export function getDb() {
  if (!cached) cached = createClient()
  return cached
}

export { schema }
export * from "./schema"
