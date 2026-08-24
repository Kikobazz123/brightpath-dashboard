"use server"

/**
 * Sign in and out.
 *
 * No credential is checked, because there is none to check — see the note in
 * `./session`. The submitted email is recorded so the header shows who is
 * signed in, but anything typed is accepted.
 */

import { redirect } from "next/navigation"

import { demoEmail, endSession, startSession } from "@/lib/auth/session"

/**
 * Only same-origin paths are followed after sign-in.
 *
 * `?next=` comes from the URL, so without this check a crafted link could send
 * someone from our sign-in page to an attacker's site wearing our branding.
 * A protocol-relative `//evil.example` is a URL the browser treats as absolute,
 * which is why the second test is there and not redundant.
 */
function safeNext(next: string | null | undefined): string {
  if (!next) return "/dashboard"
  if (!next.startsWith("/")) return "/dashboard"
  if (next.startsWith("//")) return "/dashboard"
  return next
}

export async function signIn(formData: FormData): Promise<void> {
  const submitted = formData.get("email")
  const email =
    typeof submitted === "string" && submitted.trim().length > 0
      ? submitted.trim()
      : demoEmail()

  await startSession(email)

  const next = formData.get("next")
  redirect(safeNext(typeof next === "string" ? next : null))
}

export async function signOut(): Promise<void> {
  await endSession()
  redirect("/sign-in")
}
