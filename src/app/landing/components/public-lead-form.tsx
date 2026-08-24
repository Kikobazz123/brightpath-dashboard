"use client"

/**
 * The website enquiry form — and the front door of the product.
 *
 * It replaced a contact form that logged to the console and reset itself.
 * What a visitor types here now becomes a real lead: stored, read by the
 * analyst, scored against the rubric, given a drafted reply and a
 * recommended next action, all before anyone opens the record.
 *
 * That is the case study's whole premise, so it is worth the form being real
 * rather than decorative. It is also the most honest way to demonstrate the
 * system: capture from the public site, then go and look at what arrived.
 *
 * Kept looking like a normal enquiry form on purpose. Asking a visitor for a
 * headcount band or a budget bracket would be the intake problem solved by
 * refusing the input — the analyst's job is to cope with whatever someone
 * felt like typing.
 */

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitPublicLead } from "@/lib/client/public-capture"

export function PublicLeadForm() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await submitPublicLead(formData)
      if (result.ok) setSent(true)
      else setError(result.message)
    })
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle2 className="text-primary size-10" />
        <h3 className="text-lg font-semibold">Enquiry received</h3>
        <p className="text-muted-foreground max-w-md text-sm">
          Thanks — someone will come back to you shortly. Nothing has been sent
          to you automatically; a person reads every enquiry before replying.
        </p>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            placeholder="Northgate Accounts"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Your role</Label>
        <Input id="role" name="role" placeholder="Managing Partner" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">
          What is not working? <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={9}
          className="min-h-50 resize-y"
          placeholder="What happens today, who it affects, and what you wish happened instead. Anything you mention about size, budget or timing helps us come back with something useful rather than a brochure."
        />
        <p className="text-muted-foreground text-xs">
          Your own words are more useful than a tidy summary — we quote them
          back when we reply.
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full cursor-pointer" disabled={isPending}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {isPending ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  )
}
