"use client"

import { Mail as MailIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface AccountSwitcherProps {
  isCollapsed: boolean;
  account: { label: string; email: string };
}

/**
 * The connected mailbox.
 *
 * Was a `<Select>` offering three accounts, all of them the same fictional
 * person on different providers. There is exactly one mailbox — the address in
 * `GMAIL_USER`, falling back to the brand address — so this reports it rather
 * than pretending there is a choice. It goes back to being a switcher on the
 * day there is a second account to switch to.
 */
export function AccountSwitcher({ isCollapsed, account }: AccountSwitcherProps) {
  if (isCollapsed) {
    return (
      <div
        className="flex size-9 shrink-0 items-center justify-center"
        title={account.email}
      >
        <MailIcon className="size-4" aria-hidden />
        <span className="sr-only">{account.email}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full items-center gap-2 overflow-hidden px-1")}>
      <MailIcon className="size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col text-left leading-tight">
        <span className="truncate text-sm font-medium">{account.label}</span>
        <span className="text-muted-foreground truncate text-xs">
          {account.email}
        </span>
      </div>
    </div>
  );
}
