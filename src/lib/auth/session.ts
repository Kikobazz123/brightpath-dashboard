/**
 * The demo sign-in gate.
 *
 * Be clear about what this is and is not. It is a **presentation gate**: it
 * decides whether the dashboard UI is reachable, so a visitor meets the
 * marketing site first and enters the app deliberately. It is **not
 * authentication**. There is no user record, no password check, and no
 * credential of any kind — clicking the button is the whole test.
 *
 * The real boundary is elsewhere and unchanged: every HTTP caller still needs
 * the bearer token in `src/lib/api/http.ts`, and every query is still scoped by
 * tenant. Nothing here widens or narrows access to lead data.
 *
 * It is written this way on purpose rather than by omission. Wiring real
 * accounts for a demo would add a password to look after and a table to seed,
 * and would make a judge's first interaction a login they have to be told the
 * details for. A named session that anyone can start costs nothing and reads
 * honestly, as long as nobody mistakes it for security — hence this comment.
 */

import { cookies } from "next/headers"

import { siteConfig } from "@/config/site"
import { SESSION_COOKIE } from "@/lib/auth/constants"

export { SESSION_COOKIE }

/**
 * Thirty days.
 *
 * Long deliberately: the brief for this was that signing in must not become
 * repetitive. A judge signs in once and the session outlives the session they
 * are judging.
 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface DemoSession {
  email: string
  signedInAt: string
}

/** The account the sign-in page arrives pre-filled with. */
export function demoEmail(): string {
  return process.env.DEMO_SIGNIN_EMAIL?.trim() || siteConfig.demoSignIn.email
}

/**
 * Cookie options.
 *
 * `httpOnly` so page scripts cannot read or forge it, `sameSite: lax` so it
 * survives arriving from an external link, and `secure` only in production
 * because localhost is not served over HTTPS.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  }
}

export async function startSession(email: string): Promise<void> {
  const session: DemoSession = {
    email,
    signedInAt: new Date().toISOString(),
  }
  const store = await cookies()
  store.set(SESSION_COOKIE, JSON.stringify(session), cookieOptions())
}

export async function endSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * The current session, or null.
 *
 * A malformed cookie is treated as no session rather than an error — the value
 * is client-held, so it can be anything, and a corrupted one should log
 * somebody out rather than break every page that reads it.
 */
export async function getSession(): Promise<DemoSession | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<DemoSession>
    if (typeof parsed.email !== "string" || !parsed.email) return null
    return {
      email: parsed.email,
      signedInAt:
        typeof parsed.signedInAt === "string"
          ? parsed.signedInAt
          : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export async function isSignedIn(): Promise<boolean> {
  return (await getSession()) !== null
}
