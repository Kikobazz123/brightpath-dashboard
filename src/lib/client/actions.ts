"use server"

/**
 * Mutations for React Server Components — the write half of `./server-data`.
 *
 * Same reasoning as the read side: the dashboard runs on the same server as the
 * API, so posting to `/api/v1/...` from a form would mean shipping a bearer
 * token to the browser to talk to ourselves. These call the service layer
 * directly. The HTTP API is untouched and stays the contract for genuinely
 * remote callers — the public capture form, webhooks, an external CRM.
 *
 * Every action returns `ActionResult` rather than throwing. A thrown error in a
 * Server Action reaches the browser as an opaque digest, which is useless to a
 * sales rep looking at a failed button; a returned message can be shown.
 *
 * Naming matches the API surface one-for-one, so "every frontend action maps to
 * an API" is checkable by reading the two lists side by side:
 *
 *   analyzeLead      → POST   /leads/{id}/analyze
 *   scoreLead        → POST   /leads/{id}/score
 *   draftFollowUp    → POST   /leads/{id}/follow-up
 *   recommendAction  → POST   /leads/{id}/next-action
 *   markFollowUpSent → POST   /leads/{id}/confirm-send
 *   setLeadStatus    → PATCH  /leads/{id}/status
 *   editLead         → PATCH  /leads/{id}
 *   captureLead      → POST   /leads
 *
 * Two actions have no API twin, because both send email and an unauthenticated
 * caller must never be able to make this app send mail on its own account:
 *
 *   sendFollowUpEmail → sends the draft, then POST /leads/{id}/confirm-send
 *   sendTestEmail     → one message to a given address, touches no lead
 */

import { revalidatePath } from "next/cache"

import {
  type Lead,
  type LeadStatus,
  type UpdateLeadInput,
  type EditFollowUpInput,
  companySizeSchema,
  confirmSendSchema,
  createLeadSchema,
  editFollowUpSchema,
  interestLevelSchema,
  leadSourceSchema,
  updateLeadSchema,
  updateStatusSchema,
} from "@/lib/contracts/leads"
import {
  ConflictError,
  NotFoundError,
  confirmSend,
  createLead,
  editFollowUp,
  getLead,
  runAnalysis,
  runFollowUp,
  runFullPipeline,
  runNextAction,
  runScoring,
  updateLead,
  updateStatus,
} from "@/lib/leads/service"
import {
  acknowledgeEnquiry,
  notifyNewEnquiry,
  replyToLead,
  sendFollowUp,
  sendTestMessage,
} from "@/lib/mail/service"
import { tenantId } from "@/lib/client/server-data"

/* ------------------------------------------------------------------ *
 * Result shape
 * ------------------------------------------------------------------ */

export type ActionResult<T = void> =
  | { ok: true; data: T; message: string }
  | { ok: false; message: string; fields?: Record<string, string[]> }

/**
 * The signed-in rep.
 *
 * Every activity row records who did it, and "system" would be a lie for a
 * button a human pressed. Resolved in one place so wiring real sessions later
 * is a change here rather than at every call site — the mirror of `tenantId()`.
 */
function actor(): string {
  return process.env.DEMO_ACTOR?.trim() || "rep"
}

/** Repaint every view a lead can appear in. Cheap, and never stale. */
function revalidateLead(id: string) {
  revalidatePath("/leads")
  revalidatePath(`/leads/${id}`)
  revalidatePath("/dashboard")
}

/**
 * One place where a thrown service error becomes a sentence a rep can act on.
 *
 * Provider and database failures get specific text because the fix differs;
 * anything else is logged server-side and reported generically, since an ORM
 * stack trace in a toast helps nobody and can leak schema detail.
 */
function describe(error: unknown, verb: string): ActionResult<never> {
  if (error instanceof NotFoundError) {
    return { ok: false, message: "That lead no longer exists." }
  }

  // A refused state change. The message explains the rule, so show it as-is.
  if (error instanceof ConflictError) {
    return { ok: false, message: error.message }
  }

  const message = error instanceof Error ? error.message : String(error)

  if (/DATABASE_URL/.test(message)) {
    return {
      ok: false,
      message: "The database is not configured. Set DATABASE_URL and retry.",
    }
  }
  if (/rate|429|quota/i.test(message)) {
    return {
      ok: false,
      message: "The AI provider is rate limited. Try again in a moment.",
    }
  }

  console.error(`[action:${verb}]`, message)
  return { ok: false, message: `Could not ${verb}. The error has been logged.` }
}

/** Wrap a service call so the happy path stays one line per action. */
async function run(
  id: string,
  verb: string,
  success: string,
  work: () => Promise<Lead>,
): Promise<ActionResult<Lead>> {
  try {
    const lead = await work()
    revalidateLead(id)
    return { ok: true, data: lead, message: success }
  } catch (error) {
    return describe(error, verb)
  }
}

/* ------------------------------------------------------------------ *
 * The pipeline — each stage is separately invocable
 * ------------------------------------------------------------------ *
 *
 * The stages are exposed individually rather than only as one button because
 * the judge flow is meant to be watched: qualify, then score, then draft, then
 * advise. Running them one at a time shows each output landing on its own.
 * `runEntirePipeline` exists for the impatient path and for capture-and-go.
 */

export async function analyzeLead(id: string): Promise<ActionResult<Lead>> {
  return run(id, "analyze this lead", "Evidence extracted.", () =>
    runAnalysis(tenantId(), id),
  )
}

export async function scoreLead(id: string): Promise<ActionResult<Lead>> {
  return run(id, "score this lead", "Lead scored against the rubric.", () =>
    runScoring(tenantId(), id),
  )
}

export async function draftFollowUp(id: string): Promise<ActionResult<Lead>> {
  return run(id, "draft a follow-up", "Follow-up drafted — not sent.", () =>
    runFollowUp(tenantId(), id),
  )
}

export async function recommendAction(id: string): Promise<ActionResult<Lead>> {
  return run(id, "recommend a next action", "Next action recommended.", () =>
    runNextAction(tenantId(), id),
  )
}

export async function runEntirePipeline(
  id: string,
): Promise<ActionResult<Lead>> {
  return run(
    id,
    "run the assistant",
    "Analyzed, scored, drafted and advised.",
    () => runFullPipeline(tenantId(), id),
  )
}

/* ------------------------------------------------------------------ *
 * Human decisions
 * ------------------------------------------------------------------ */

/**
 * Move the lead's sales status.
 *
 * Only ever called from a human control. The pipeline computes priority and
 * recommends actions; where the deal actually stands is the rep's call, and
 * nothing in `src/lib/pipeline` can write this field.
 */
export async function setLeadStatus(
  id: string,
  status: LeadStatus,
  note?: string | null,
): Promise<ActionResult<Lead>> {
  const parsed = updateStatusSchema.safeParse({ status, note: note ?? null })
  if (!parsed.success) {
    return { ok: false, message: "That is not a valid lead status." }
  }

  const readable = parsed.data.status.replace(/_/g, " ")
  return run(id, "update the status", `Status set to ${readable}.`, () =>
    updateStatus(tenantId(), id, parsed.data.status, parsed.data.note, actor()),
  )
}

export async function editLead(
  id: string,
  input: UpdateLeadInput,
): Promise<ActionResult<Lead>> {
  const parsed = updateLeadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Those changes are not valid.",
      fields: fieldErrors(parsed.error),
    }
  }

  return run(id, "save those changes", "Lead updated.", () =>
    updateLead(tenantId(), id, parsed.data, actor()),
  )
}

/** Assign or reassign the owning rep — the "high-priority leads do not vanish" guard. */
export async function assignOwner(
  id: string,
  owner: string | null,
): Promise<ActionResult<Lead>> {
  return editLead(id, { owner: owner?.trim() || null })
}

/**
 * Record that the drafted message was really sent.
 *
 * Deliberately awkward: it demands a provider and that provider's message id,
 * because `sent` is the one state the system must never be able to assert on
 * its own. Until an email integration is wired, a rep who sends the draft from
 * their own client pastes the message id here — which is honest, where a
 * "Mark as sent" button that takes no proof would not be.
 */
export async function markFollowUpSent(
  id: string,
  provider: string,
  providerMessageId: string,
  sentAt?: string,
): Promise<ActionResult<Lead>> {
  const parsed = confirmSendSchema.safeParse({
    provider,
    provider_message_id: providerMessageId,
    sent_at: sentAt ?? new Date().toISOString(),
  })
  if (!parsed.success) {
    return {
      ok: false,
      message: "Recording a send needs both the provider and its message id.",
      fields: fieldErrors(parsed.error),
    }
  }

  return run(id, "record the send", "Send recorded with proof.", () =>
    confirmSend(
      tenantId(),
      id,
      parsed.data.provider,
      parsed.data.provider_message_id,
      new Date(parsed.data.sent_at),
      actor(),
    ),
  )
}

/* ------------------------------------------------------------------ *
 * Capture
 * ------------------------------------------------------------------ */

/**
 * Create a lead from the dashboard capture form.
 *
 * Takes `FormData` so the form works as a progressively-enhanced `<form action>`
 * — it submits with JavaScript disabled, and a rep pasting a phone note is not
 * blocked by a hydration failure.
 *
 * `auto_run` runs the whole assistant on arrival. That is the demo path: a lead
 * lands and is already qualified, scored, drafted and advised by the time the
 * rep looks at it, which is precisely the delay BrightPath is losing deals to.
 */
export async function captureLead(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const text = (key: string): string | null => {
    const value = formData.get(key)
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  const rawSource = text("source")
  const rawSize = text("company_size")
  const rawInterest = text("interest_level")

  // Optional selects submit "" for "not stated". Empty is absence of evidence,
  // not a value — drop it rather than failing validation on a blank string.
  const candidate = {
    source: leadSourceSchema.safeParse(rawSource).success ? rawSource : "website",
    contact: {
      name: text("contact_name"),
      email: text("contact_email"),
      phone: text("contact_phone"),
      role: text("contact_role"),
    },
    company: text("company"),
    company_size: companySizeSchema.safeParse(rawSize).success ? rawSize : null,
    industry: text("industry"),
    budget: text("budget"),
    need: text("need"),
    interest_level: interestLevelSchema.safeParse(rawInterest).success
      ? rawInterest
      : null,
    message: text("message") ?? "",
    extra: {},
  }

  const parsed = createLeadSchema.safeParse(candidate)
  if (!parsed.success) {
    return {
      ok: false,
      message: "That lead could not be saved.",
      fields: fieldErrors(parsed.error),
    }
  }

  // A lead with no contact route and no story is a blank form, not a lead.
  const hasContact =
    parsed.data.contact.email ||
    parsed.data.contact.phone ||
    parsed.data.contact.name
  const hasSubstance =
    parsed.data.message.trim().length > 0 ||
    parsed.data.company ||
    parsed.data.need
  if (!hasContact || !hasSubstance) {
    return {
      ok: false,
      message:
        "Give at least a name, email or phone, plus a company, need or message.",
    }
  }

  const autoRun = formData.get("auto_run") === "on"
  const notifyContact = formData.get("notify_contact") === "on"

  try {
    const lead = await createLead(tenantId(), parsed.data, actor())
    let pipelineFailed = false

    if (autoRun) {
      // A failure here must not lose the lead — it is already saved, and the
      // rep can re-run the assistant from the detail page.
      try {
        await runFullPipeline(tenantId(), lead.id)
      } catch (error) {
        console.error("[action:capture:pipeline]", error)
        pipelineFailed = true
      }
    }

    /**
     * Mail, if the rep asked for it.
     *
     * Opt-in rather than automatic, and reported honestly. A rep capturing a
     * phone call has usually just spoken to the person, so an unbidden "thanks
     * for your enquiry" would be odd; a rep testing the mailing automation
     * wants to see something land in a real inbox. The checkbox is which of
     * those this is.
     *
     * A mail failure never turns capture into a failure, but unlike the public
     * form it is surfaced, because the person who ticked the box is the person
     * who can go and fix the credentials.
     */
    let mailNote = ""
    if (notifyContact) {
      try {
        const captured = await getLead(tenantId(), lead.id)
        const [alert, ack] = await Promise.all([
          notifyNewEnquiry(captured),
          acknowledgeEnquiry(captured),
        ])

        const failure =
          (alert.attempted && !alert.ok && alert.reason) ||
          (ack.attempted && !ack.ok && ack.reason)

        if (failure) {
          mailNote = ` Email did not go out: ${failure}`
        } else if (!alert.attempted && !ack.attempted) {
          mailNote =
            " No mailbox is connected, so nothing was emailed — set GMAIL_USER and GMAIL_APP_PASSWORD."
        } else {
          mailNote = ack.ok
            ? ` Emailed ${captured.contact.email}.`
            : " Notified the team inbox."
        }
      } catch (error) {
        console.error("[action:capture:mail]", error)
        mailNote = " The lead was saved, but the email step failed."
      }
    }

    revalidateLead(lead.id)

    if (pipelineFailed) {
      return {
        ok: true,
        data: { id: lead.id },
        message:
          "Lead captured, but the assistant could not finish. Re-run it from the lead." +
          mailNote,
      }
    }

    return {
      ok: true,
      data: { id: lead.id },
      message:
        (autoRun ? "Lead captured and assessed." : "Lead captured.") + mailNote,
    }
  } catch (error) {
    return describe(error, "capture that lead")
  }
}

/**
 * Rewrite the drafted follow-up by hand.
 *
 * The model produces a first version; the words that actually reach a customer
 * are the rep's. Refused once the message has been sent — see `editFollowUp`.
 */
export async function saveFollowUpDraft(
  id: string,
  input: EditFollowUpInput,
): Promise<ActionResult<Lead>> {
  const parsed = editFollowUpSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "That draft cannot be saved as written.",
      fields: fieldErrors(parsed.error),
    }
  }

  return run(id, "save that draft", "Draft updated.", () =>
    editFollowUp(tenantId(), id, parsed.data, actor()),
  )
}

/**
 * Send the drafted follow-up for real.
 *
 * The counterpart to `markFollowUpSent`, which records a send a rep performed
 * elsewhere. This one performs it, and the proof it stores is the message id
 * the mail server returned rather than one typed in by hand. If the send
 * fails, nothing is recorded and the lead stays `drafted`.
 */
export async function sendFollowUpEmail(
  id: string,
): Promise<ActionResult<Lead>> {
  try {
    const lead = await getLead(tenantId(), id)
    const result = await sendFollowUp(tenantId(), lead, actor())

    if (!result.ok) {
      return { ok: false, message: result.reason }
    }

    revalidateLead(id)
    return {
      ok: true,
      data: result.lead,
      message: `Sent to ${lead.contact.email}. Recorded with the provider's message id.`,
    }
  } catch (error) {
    return describe(error, "send that follow-up")
  }
}

/**
 * Reply to an enquiry from the Inbox.
 *
 * Sends what the rep typed, and deliberately leaves `follow_up_state` alone. A
 * hand-written reply is correspondence; the drafted follow-up is a specific
 * message the assistant wrote. Letting one flip the state of the other would
 * make `sent` a claim about a message nobody can point to.
 */
export async function replyToEnquiry(
  leadId: string,
  subject: string,
  body: string,
): Promise<ActionResult<void>> {
  if (!body.trim()) {
    return { ok: false, message: "The reply is empty." }
  }

  try {
    const lead = await getLead(tenantId(), leadId)
    const result = await replyToLead(lead, subject, body)

    if (!result.ok) {
      return {
        ok: false,
        message: result.reason ?? "The reply could not be sent.",
      }
    }

    revalidateLead(leadId)
    revalidatePath("/mail")
    return {
      ok: true,
      data: undefined,
      message: `Reply sent to ${lead.contact.email}.`,
    }
  } catch (error) {
    return describe(error, "send that reply")
  }
}

/** Sends one plain message to any address, to prove the mailbox is connected. */
export async function sendTestEmail(to: string): Promise<ActionResult<void>> {
  const address = to.trim()
  if (!address.includes("@")) {
    return { ok: false, message: "That does not look like an email address." }
  }

  const result = await sendTestMessage(address)
  if (!result.ok) {
    return {
      ok: false,
      message: result.reason ?? "The message could not be sent.",
    }
  }

  return {
    ok: true,
    data: undefined,
    message: `Test message sent to ${address}.`,
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function fieldErrors(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[]
}): Record<string, string[]> {
  const fields: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_"
    ;(fields[key] ??= []).push(issue.message)
  }
  return fields
}
