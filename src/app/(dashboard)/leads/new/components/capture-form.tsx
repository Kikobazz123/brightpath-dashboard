"use client"

/**
 * Lead capture.
 *
 * Only the free-text box really matters. Everything else is optional on
 * purpose: this stands in for a website form, a forwarded email, or a rep
 * typing up a phone call, and none of those arrive with tidy fields. The
 * analyst's job is to pull evidence out of whatever text shows up — so a form
 * that demanded a company size would be solving the problem by refusing the
 * input.
 *
 * Structured fields, when a rep does have them, are recorded as given rather
 * than inferred, which is why they are here at all.
 */

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { captureLead, sendTestEmail } from "@/lib/client/actions"
import {
  COMPANY_SIZE_BANDS,
  INTEREST_LEVELS,
  LEAD_SOURCES,
} from "@/lib/contracts/leads"
import { SOURCE_LABEL } from "@/lib/leads/display"

/** Radix Select cannot hold "" as a value; this is the "not stated" option. */
const UNSTATED = "__unstated__"

const EXAMPLE = `Hi — we're a 40-person accountancy practice in Leeds and our client onboarding is completely manual. Every new client takes about three hours of admin across four different spreadsheets, and we're onboarding maybe fifteen a month now.

We've set aside around £25,000 for this and we'd like something live before our year end in April. Could we get a call this week?`

export function CaptureForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isTesting, startTesting] = useTransition()
  const [fields, setFields] = useState<Record<string, string[]>>({})
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")

  function onSubmit(formData: FormData) {
    setFields({})

    startTransition(async () => {
      const result = await captureLead(formData)

      if (!result.ok) {
        setFields(result.fields ?? {})
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      router.push(`/leads/${result.data.id}`)
    })
  }

  /**
   * Sends one message to the address typed above, without saving anything.
   *
   * Here rather than in Settings because this is where someone first wonders
   * whether the mailing actually works, and because it answers the question
   * with a message in a real inbox instead of a green tick.
   */
  function onTestSend() {
    startTesting(async () => {
      const result = await sendTestEmail(email)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>What arrived</CardTitle>
          <CardDescription>
            Paste the enquiry exactly as it came in. The assistant quotes this
            text back as evidence for every signal it finds, so the raw wording
            is worth more than a tidied summary.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Enquiry, email body or call notes"
            name="message"
            errors={fields["message"]}
          >
            <Textarea
              id="message"
              name="message"
              rows={9}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Paste the lead's own words here…"
              className="resize-y"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMessage(EXAMPLE)}
            >
              Use a sample enquiry
            </Button>
            {message ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMessage("")}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>
            At least one way to reach them. Blank fields stay blank — nothing
            here is inferred.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="contact_name" errors={fields["contact.name"]}>
            <Input id="contact_name" name="contact_name" autoComplete="name" />
          </Field>
          <Field label="Email" name="contact_email" errors={fields["contact.email"]}>
            <div className="flex gap-2">
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={onTestSend}
                disabled={isTesting || !email.includes("@")}
                title="Send one test message to this address"
              >
                {isTesting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Test
              </Button>
            </div>
          </Field>
          <Field label="Phone" name="contact_phone" errors={fields["contact.phone"]}>
            <Input id="contact_phone" name="contact_phone" type="tel" />
          </Field>
          <Field label="Role" name="contact_role" errors={fields["contact.role"]}>
            <Input
              id="contact_role"
              name="contact_role"
              placeholder="Managing Partner"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What you already know</CardTitle>
          <CardDescription>
            Optional. Fill in only what the lead actually told you — a guess here
            becomes evidence the score is built on.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" name="company" errors={fields["company"]}>
            <Input id="company" name="company" autoComplete="organization" />
          </Field>
          <Field label="Industry" name="industry" errors={fields["industry"]}>
            <Input id="industry" name="industry" placeholder="Accounting" />
          </Field>

          <Field label="Company size" name="company_size">
            <SelectField
              name="company_size"
              placeholder="Not stated"
              options={COMPANY_SIZE_BANDS.map((band) => ({
                value: band,
                label: `${band} employees`,
              }))}
            />
          </Field>

          <Field label="Source" name="source">
            <SelectField
              name="source"
              placeholder="Website"
              defaultValue="website"
              allowUnstated={false}
              options={LEAD_SOURCES.map((source) => ({
                value: source,
                label: SOURCE_LABEL[source],
              }))}
            />
          </Field>

          <Field label="Budget" name="budget" errors={fields["budget"]}>
            <Input id="budget" name="budget" placeholder="£25,000" />
          </Field>

          <Field label="Interest level" name="interest_level">
            <SelectField
              name="interest_level"
              placeholder="Not stated"
              options={INTEREST_LEVELS.map((level) => ({
                value: level,
                label: level[0].toUpperCase() + level.slice(1),
              }))}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Stated need" name="need" errors={fields["need"]}>
              <Input
                id="need"
                name="need"
                placeholder="Manual client onboarding taking three hours per client"
              />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox id="auto_run" name="auto_run" defaultChecked />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium leading-none">
                Run the assistant on arrival
              </span>
              <span className="text-muted-foreground text-sm">
                Extract evidence, score against the rubric, draft a reply and
                recommend a next action — before anyone opens the lead. This is
                the delay BrightPath is losing deals to.
              </span>
            </span>
          </label>

          {/*
            * Off by default, unlike the assistant above.
            *
            * Ticking this sends real mail to a real person. A rep typing up a
            * call they have just finished does not want the caller to receive
            * "thanks for your enquiry" ten seconds later, so the safe default
            * is silence and the loud thing is opt-in.
            */}
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox id="notify_contact" name="notify_contact" />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium leading-none">
                Email this contact and the team inbox
              </span>
              <span className="text-muted-foreground text-sm">
                Sends an acknowledgement to the email address above and an alert
                with the score to the connected mailbox — the same two messages
                a website enquiry triggers. Leave it off unless you mean it:
                these go to a real person.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/leads")}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isPending ? "Capturing…" : "Capture lead"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  )
}

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string
  name: string
  errors?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.length ? (
        <p className="text-destructive text-sm">{errors.join(" ")}</p>
      ) : null}
    </div>
  )
}

/**
 * A Select that submits with the form.
 *
 * Radix renders a button, not a native `<select>`, so its value would never
 * reach `FormData`. The hidden input is what actually gets submitted.
 */
function SelectField({
  name,
  options,
  placeholder,
  defaultValue,
  allowUnstated = true,
}: {
  name: string
  options: { value: string; label: string }[]
  placeholder: string
  defaultValue?: string
  allowUnstated?: boolean
}) {
  const [value, setValue] = useState(defaultValue ?? UNSTATED)

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={value === UNSTATED ? "" : value}
      />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowUnstated ? (
            <SelectItem value={UNSTATED}>Not stated</SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
