"use client"

import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { replyToEnquiry } from "@/lib/client/actions";
import { type InboxMessage } from "../inbox-data";
import { useState, useTransition } from "react";

/**
 * The reading pane.
 *
 * The toolbar that used to run across the top — archive, junk, trash, snooze
 * with a date picker, reply-all, forward, and a "Mute thread" switch — was
 * eight controls, none of which did anything to anything. They are gone. What
 * is left are the two actions that work: open the underlying lead, and reply.
 *
 * The reply box sends for real, through the connected mailbox, to the address
 * on the lead. With no mailbox connected it says so and stays disabled rather
 * than accepting text it cannot deliver.
 */

interface MailDisplayProps {
  mail: InboxMessage | null;
  mailConfigured: boolean;
}

export function MailDisplay({ mail, mailConfigured }: MailDisplayProps) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [isSending, startSending] = useTransition();

  const hasAddress = mail !== null && mail.email.includes("@");
  const canSend = mailConfigured && hasAddress && reply.trim().length > 0;

  function send() {
    if (!mail) return;

    startSending(async () => {
      const result = await replyToEnquiry(
        mail.leadId,
        `Re: ${mail.subject}`,
        reply,
      );

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setReply("");
      router.refresh();
    });
  }

  if (!mail) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Select an enquiry to read it.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/leads/${mail.leadId}`}>
            <ExternalLink className="size-4" />
            Open lead
          </Link>
        </Button>
        <span className="text-muted-foreground ml-auto pr-2 text-xs">
          {format(new Date(mail.date), "PPpp")}
        </span>
      </div>
      <Separator />

      <div className="flex flex-1 flex-col">
        <div className="flex items-start p-4">
          <div className="flex items-start gap-4 text-sm">
            <Avatar>
              <AvatarImage alt={mail.name} />
              <AvatarFallback>
                {mail.name
                  .split(" ")
                  .map((chunk) => chunk[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <div className="font-semibold">{mail.name}</div>
              <div className="line-clamp-1 text-xs">{mail.subject}</div>
              <div className="line-clamp-1 text-xs">
                <span className="font-medium">Reply-To:</span> {mail.email}
              </div>
            </div>
          </div>
        </div>
        <Separator />

        <div className="flex-1 p-4 text-sm whitespace-pre-wrap">{mail.text}</div>
        <Separator className="mt-auto" />

        <div className="p-4">
          <div className="grid gap-4">
            <Textarea
              className="p-4 cursor-text"
              placeholder={
                mailConfigured
                  ? `Reply to ${mail.name}…`
                  : "No mailbox is connected, so replies cannot be sent from here."
              }
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              disabled={!mailConfigured || !hasAddress}
            />
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground text-xs">
                {!mailConfigured
                  ? "Set GMAIL_USER and GMAIL_APP_PASSWORD to send from here."
                  : !hasAddress
                    ? "This enquiry arrived without an email address."
                    : `Sends to ${mail.email}. Recorded against the lead.`}
              </p>
              <Button
                size="sm"
                className="ml-auto cursor-pointer"
                onClick={send}
                disabled={!canSend || isSending}
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {isSending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
