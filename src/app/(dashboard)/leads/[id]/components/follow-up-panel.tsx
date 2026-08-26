"use client"

/**
 * The drafted follow-up.
 *
 * "Send now" performs a real SMTP send through the connected mailbox and only
 * then records the state, storing the message id the server handed back. That
 * ordering is the whole rule this panel is built around: `sent` is reachable
 * only with proof of delivery, and a button that merely flipped a database
 * column would be the most damaging lie the app could tell — the case study is
 * about leads going cold, and a false "sent" is how that happens invisibly.
 *
 * The manual path is kept alongside it, and is not a fallback. A rep who sends
 * from their own client pastes that client's message id into "Record a send",
 * which satisfies the same contract by hand. When no mailbox is connected, that
 * is the only route, and the panel says so rather than offering a button that
 * cannot work.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Check,
  Copy,
  HelpCircle,
  Loader2,
  Pencil,
  Send,
  ShieldCheck,
} from "lucide-react"

import { FollowUpBadge } from "@/components/leads/badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  markFollowUpSent,
  saveFollowUpDraft,
  sendFollowUpEmail,
} from "@/lib/client/actions"
import type { FollowUpDraft, FollowUpState } from "@/lib/contracts/leads"
import {
  SIGNAL_LABEL,
  formatTimestamp,
  toneClass,
} from "@/lib/leads/display"

export function FollowUpPanel({
  leadId,
  draft,
  state,
  contactEmail,
  mailConfigured,
}: {
  leadId: string
  draft: FollowUpDraft | null
  state: FollowUpState
  contactEmail: string | null
  /** Whether a mailbox is connected. Decides which send routes are offered. */
  mailConfigured: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)

  /**
   * Drafts written before clarifications existed carry no kind, and those were
   * all sales follow-ups — so an absent kind reads as `follow_up` rather than
   * as unknown.
   */
  const clarifying = draft?.kind === "clarification"

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follow-up</CardTitle>
          <CardDescription>
            No draft yet. The writer only uses facts the analyst extracted, so a
            message written now would reference nothing.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  async function copyMessage() {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(
        `Subject: ${draft.subject}\n\n${draft.message}`,
      )
      setCopied(true)
      toast.success("Draft copied to the clipboard.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("The browser blocked clipboard access. Select and copy manually.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span>{clarifying ? "Clarification" : "Follow-up"}</span>
          <FollowUpBadge state={state} />
          {clarifying ? (
            <Badge variant="outline">Asks for detail</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Drafted {formatTimestamp(draft.generated_at)} by{" "}
          <span className="font-mono text-xs">{draft.model}</span>
          {contactEmail ? ` · for ${contactEmail}` : null}
          {draft.edited_at ? (
            <>
              {" · "}
              <span className="text-foreground font-medium">
                edited by hand {formatTimestamp(draft.edited_at)}
              </span>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {editing ? (
          <DraftEditor
            leadId={leadId}
            draft={draft}
            onClose={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Subject
              </Label>
              <p className="font-medium">{draft.subject}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Message
              </Label>
              <div className="bg-muted/40 rounded-lg border p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {draft.message}
                </p>
              </div>
            </div>
          </>
        )}

        {draft.grounded_in.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Personalised using
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {draft.grounded_in.map((signal) => (
                <Badge key={signal} variant="outline">
                  {SIGNAL_LABEL[signal]}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              The message draws only on these extracted signals, so every
              personal detail in it traces back to something the lead said.
            </p>
          </div>
        ) : null}

        {/*
          * Why this is a clarification rather than a pitch.
          *
          * Shown above the send controls on purpose: a rep who does not
          * realise the enquiry was unreadable might send this thinking it is a
          * sales reply, then wonder why it asks so many questions.
          */}
        {clarifying && state !== "sent" && state !== "replied" ? (
          <div
            className={
              "flex items-start gap-3 rounded-lg p-3 text-sm " + toneClass("warning")
            }
          >
            <HelpCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              This enquiry did not say enough to answer properly, so the
              assistant wrote back asking for the missing detail instead of
              pitching. Read it before sending — if you can already tell what
              they need, edit it into a real reply.
            </span>
          </div>
        ) : null}

        {state !== "sent" && state !== "replied" ? (
          <div
            className={
              "flex items-start gap-3 rounded-lg p-3 text-sm " + toneClass("info")
            }
          >
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              {mailConfigured
                ? contactEmail
                  ? `This is a draft. Nothing has been sent yet — "Send now" delivers it to ${contactEmail} and records the send with the message id the mail server returns.`
                  : "This is a draft. There is no email address on this lead, so it can only be copied out and sent by hand."
                : "This is a draft. No mailbox is connected, so nothing can be sent from here — copy it out, then record the send with your mail client's message id."}
            </span>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {/*
          * The real send leads, because it is the one that is safe to press:
          * it either delivers and records proof, or it fails and changes
          * nothing. The manual route stays beside it for a rep who prefers
          * their own client, not as a fallback for this one.
          */}
        {mailConfigured && contactEmail ? (
          <SendNowButton
            leadId={leadId}
            contactEmail={contactEmail}
            disabled={state === "sent" || editing}
          />
        ) : null}

        {/*
          * Editing stops once the message has gone out. The stored draft is
          * the only record of what the recipient actually received, so letting
          * it be rewritten afterwards would leave the audit trail disagreeing
          * with their inbox. The service refuses it too — this only hides a
          * button that would fail.
          */}
        {!editing && state !== "sent" && state !== "replied" ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit draft
          </Button>
        ) : null}

        <Button variant="outline" onClick={copyMessage}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy draft"}
        </Button>

        {contactEmail ? (
          <Button asChild variant="outline">
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                draft.subject,
              )}&body=${encodeURIComponent(draft.message)}`}
            >
              Open in mail client
            </a>
          </Button>
        ) : null}

        <RecordSendDialog leadId={leadId} disabled={state === "sent"} />
      </CardFooter>
    </Card>
  )
}

/**
 * Rewrite the draft in place.
 *
 * Seeded from the current draft rather than starting blank — the point is to
 * adjust a sentence or fix a sign-off, not to retype the message. Saving stamps
 * `edited_at`, which is what stops the panel from going on describing
 * hand-written prose as the model's output.
 */
function DraftEditor({
  leadId,
  draft,
  onClose,
}: {
  leadId: string
  draft: FollowUpDraft
  onClose: () => void
}) {
  const router = useRouter()
  const [subject, setSubject] = useState(draft.subject)
  const [message, setMessage] = useState(draft.message)
  const [isPending, startTransition] = useTransition()

  const dirty = subject !== draft.subject || message !== draft.message
  const valid = subject.trim().length > 0 && message.trim().length > 0

  function save() {
    startTransition(async () => {
      const result = await saveFollowUpDraft(leadId, { subject, message })

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="draft_subject">Subject</Label>
        <Input
          id="draft_subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="draft_message">Message</Label>
        <Textarea
          id="draft_message"
          rows={12}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={isPending}
          className="resize-y font-normal leading-relaxed"
        />
        <p className="text-muted-foreground text-xs">
          Blank lines are kept exactly as you type them — this is the text that
          gets sent.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={isPending || !dirty || !valid}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        {dirty ? (
          <span className="text-muted-foreground text-xs">Unsaved changes</span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Sends the draft through the connected mailbox.
 *
 * Confirms first. Everything else on this page is reversible — a status can be
 * changed back, the assistant can be re-run — but an email that has left the
 * building cannot be recalled, so the one irreversible action asks.
 */
function SendNowButton({
  leadId,
  contactEmail,
  disabled,
}: {
  leadId: string
  contactEmail: string
  disabled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const result = await sendFollowUpEmail(leadId)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Send className="size-4" />
          {disabled ? "Sent" : "Send now"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send this follow-up?</DialogTitle>
          <DialogDescription>
            The drafted message goes to <strong>{contactEmail}</strong> from the
            connected mailbox. This cannot be undone. The lead moves to{" "}
            <strong>sent</strong> only if the mail server accepts it, and the
            message id it returns is stored as the proof.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isPending ? "Sending…" : "Send it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Records a real send.
 *
 * Both fields are required by the contract, not just by this form — the service
 * refuses the write without them. The dialog exists to collect the proof, not
 * to decorate a state change.
 */
function RecordSendDialog({
  leadId,
  disabled,
}: {
  leadId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState("")
  const [messageId, setMessageId] = useState("")
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const result = await markFollowUpSent(leadId, provider, messageId)

      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      setProvider("")
      setMessageId("")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          {disabled ? "Send recorded" : "Record a send"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record that this was sent</DialogTitle>
          <DialogDescription>
            The lead moves to <strong>sent</strong> only with proof of delivery.
            Paste the identifier your mail provider assigned the message — in
            Gmail, the Message-ID header.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="gmail"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider_message_id">Provider message id</Label>
            <Input
              id="provider_message_id"
              value={messageId}
              onChange={(event) => setMessageId(event.target.value)}
              placeholder="CADnv…@mail.gmail.com"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !provider.trim() || !messageId.trim()}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Record send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
