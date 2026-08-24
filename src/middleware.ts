import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { SESSION_COOKIE } from "@/lib/auth/constants"

/**
 * Route gate for the dashboard.
 *
 * The app half of this site sits behind a sign-in so a visitor lands on the
 * marketing site first and enters the product deliberately. It is a
 * presentation gate, not authentication — the cookie is not verified here and
 * carries no authority. See `src/lib/auth/session.ts` for why that is a
 * deliberate choice and where the real boundary actually lives.
 *
 * `/api` is excluded by the matcher and keeps its own bearer-token check.
 * Gating it here too would break the public capture form and every webhook,
 * which are supposed to be reachable without a browser session.
 */

/** Every route inside the `(dashboard)` group. */
const PROTECTED = [
  "/dashboard",
  "/dashboard-2",
  "/leads",
  "/mail",
  "/tasks",
  "/chat",
  "/calendar",
  "/users",
  "/settings",
  "/faqs",
  "/pricing",
]

function isProtected(pathname: string): boolean {
  return PROTECTED.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
}

/** Only same-origin paths are followed, so `?next=` cannot send anyone off-site. */
function safeNext(next: string | null): string | null {
  if (!next) return null
  if (!next.startsWith("/") || next.startsWith("//")) return null
  return next
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  if (isProtected(pathname) && !signedIn) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    // Carry the intended destination so the click lands where it was aimed.
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  /**
   * Signing in twice is the thing this was explicitly asked not to do, so a
   * visitor who already has a session and lands on the sign-in page is sent
   * onward rather than shown a form they have no reason to fill in again.
   */
  if (signedIn && pathname === "/sign-in") {
    const url = request.nextUrl.clone()
    url.pathname = safeNext(request.nextUrl.searchParams.get("next")) ?? "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /**
     * Everything except API routes, Next's own assets and the favicon. The API
     * keeps its bearer-token boundary; the rest are not pages.
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
