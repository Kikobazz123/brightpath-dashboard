import { sql } from "drizzle-orm"

import { getDb } from "../src/lib/db"
import { activities, leads } from "../src/lib/db/schema"

/** Quick health read of what is actually in the database. */
async function main() {
  const db = getDb()

  const rows = await db
    .select({
      tenant: leads.tenantId,
      total: sql<number>`count(*)::int`,
      high: sql<number>`count(*) filter (where priority = 'HIGH')::int`,
      review: sql<number>`count(*) filter (where qualification_status = 'NEEDS_REVIEW')::int`,
      breached: sql<number>`count(*) filter (where sla_state = 'breached')::int`,
    })
    .from(leads)
    .groupBy(leads.tenantId)

  const [{ acts }] = await db
    .select({ acts: sql<number>`count(*)::int` })
    .from(activities)

  console.table(rows)
  console.log("activity rows:", acts)
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
