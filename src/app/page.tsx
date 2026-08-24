import { redirect } from "next/navigation"

import { isSignedIn } from "@/lib/auth/session"

/**
 * The front door.
 *
 * A signed-in user is here to work, so they go to the pipeline. Everyone else
 * meets the marketing site, which is where the sign-in lives. This replaced a
 * client-side redirect that sent every visitor straight to /dashboard — with
 * the route gate in place that would have bounced a first-time visitor through
 * a spinner to a sign-in page, having never seen the product being sold.
 */
export default async function RootPage() {
  redirect((await isSignedIn()) ? "/dashboard" : "/landing")
}
