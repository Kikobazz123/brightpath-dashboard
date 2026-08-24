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
import { CheckCircle2, Loader2, Send, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitPublicLead } from "@/lib/client/public-capture"

/** Empty form state. Fields are controlled so the sample can populate them. */
const BLANK = {
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  role: "",
  message: "",
}

/**
 * A worked example, for anyone evaluating this rather than actually enquiring.
 *
 * Written to state all five qualification signals plainly — size, sector, a
 * named problem with a cost, a budget and an explicit ask — so the assistant
 * has something real to find and the resulting score is worth looking at. A
 * vague sample would demonstrate the NEEDS_REVIEW path instead, which is
 * honest but is not what someone clicking this wants to see first.
 *
 * Deliberately a different business from the dashboard's sample, so trying
 * both does not produce two near-identical leads on the board.
 */
const SAMPLE = {
  firstName: "Rosa",
  lastName: "Delgado",
  email: "rosa.delgado@harborline-clinics.co.uk",
  company: "Harborline Clinics",
  role: "Practice Manager",
  message: `We run six dental practices with about 70 staff between them. Patient recall is still done by hand on spreadsheets, and we reckon we are losing around 40 appointments a month simply because nobody gets round to chasing them.

We have set aside roughly £30,000 for this and we would like it working before the new financial year in April. Could someone give us a call this week?`,
}

export function PublicLeadForm() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState(BLANK)

  const set = (key: keyof typeof BLANK) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setFields((current) => ({ ...current, [key]: event.target.value }))

  const dirty = Object.values(fields).some((value) => value.length > 0)

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
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            value={fields.firstName}
            onChange={set("firstName")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            value={fields.lastName}
            onChange={set("lastName")}
          />
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
            value={fields.email}
            onChange={set("email")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            placeholder="Northgate Accounts"
            value={fields.company}
            onChange={set("company")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Your role</Label>
        <Input
          id="role"
          name="role"
          placeholder="Managing Partner"
          value={fields.role}
          onChange={set("role")}
        />
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
          value={fields.message}
          onChange={set("message")}
          placeholder="What happens today, who it affects, and what you wish happened instead. Anything you mention about size, budget or timing helps us come back with something useful rather than a brochure."
        />
        <p className="text-muted-foreground text-xs">
          Your own words are more useful than a tidy summary — we quote them
          back when we reply.
        </p>
      </div>

      {/*
        For anyone evaluating rather than enquiring. Filling six fields by hand
        to see what the assistant does with them is friction between a visitor
        and the point of the page.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => {
            setFields(SAMPLE)
            setError(null)
          }}
          disabled={isPending}
        >
          <Wand2 className="size-4" />
          Use a sample enquiry
        </Button>
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              setFields(BLANK)
              setError(null)
            }}
            disabled={isPending}
          >
            Clear
          </Button>
        ) : null}
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
