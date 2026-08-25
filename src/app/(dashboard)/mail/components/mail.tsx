"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCheck,
  Globe,
  Inbox,
  Phone,
  Search,
  Users2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AccountSwitcher } from "./account-switcher"
import { MailDisplay } from "./mail-display"
import { MailList } from "./mail-list"
import { Nav } from "./nav"
import type { InboxMessage } from "../inbox-data"
import { useMail } from "../use-mail"

/**
 * The Inbox shell.
 *
 * Two things changed from the template this came from, and they are the same
 * change twice: everything shown is now real.
 *
 * The folder rail used to list Drafts / Junk / Trash / Social / Promotions with
 * invented counts beside them — 972 social messages in a mailbox holding nine.
 * Those folders had nothing behind them and never would, so they are gone.
 * What replaced them are filters over what actually arrived: which channel it
 * came in on, and whether it still needs answering. Every count is computed
 * from the messages in the list.
 *
 * "Compose" went with them. This is a mailbox for reading enquiries and
 * replying in place; a compose window with nowhere useful to send was a button
 * that could only disappoint.
 */

interface MailProps {
  account: { label: string; email: string }
  /** Whether a real send is possible. Decides if the reply box is live. */
  mailConfigured: boolean
  messages: InboxMessage[]
  counts: {
    all: number
    unread: number
    website: number
    answered: number
    overdue: number
  }
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  navCollapsedSize: number
}

/** Which subset of the inbox the rail is currently showing. */
type Folder = "all" | "website" | "direct" | "answered" | "overdue"

const FOLDER_LABEL: Record<Folder, string> = {
  all: "All enquiries",
  website: "From the website",
  direct: "Phone and referral",
  answered: "Answered",
  overdue: "Overdue",
}

/**
 * `website` is the source the public form writes; everything else arrived some
 * other way. Splitting on that one label is what filtering the mail coming in
 * from the website amounts to.
 */
function inFolder(message: InboxMessage, folder: Folder): boolean {
  switch (folder) {
    case "all":
      return true
    case "website":
      return message.labels.includes("website")
    case "direct":
      return !message.labels.includes("website")
    case "answered":
      return message.labels.includes("answered")
    case "overdue":
      return message.labels.includes("overdue")
  }
}

export function Mail({
  account,
  mailConfigured,
  messages,
  counts,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: MailProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const [folder, setFolder] = React.useState<Folder>("all")
  const [query, setQuery] = React.useState("")
  const [mail] = useMail()

  const directCount = counts.all - counts.website

  /**
   * Folder, then search.
   *
   * Searching the message body as well as the header fields is deliberate:
   * what someone remembers about an enquiry is usually a phrase from inside it
   * — "the dental one", "the £30k budget" — not the sender's surname.
   */
  const visible = React.useMemo(() => {
    const term = query.trim().toLowerCase()
    return messages
      .filter((message) => inFolder(message, folder))
      .filter((message) =>
        term
          ? [message.name, message.email, message.subject, message.text]
              .join(" ")
              .toLowerCase()
              .includes(term)
          : true,
      )
  }, [messages, folder, query])

  const selected = visible.find((item) => item.id === mail.selected) ?? null

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          document.cookie = `react-resizable-panels:layout:mail=${JSON.stringify(sizes)}`
        }}
        className="h-full items-stretch rounded-lg border overflow-hidden"
      >
        <ResizablePanel
          defaultSize={defaultLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={15}
          maxSize={20}
          onCollapse={() => {
            setIsCollapsed(true)
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(true)}`
          }}
          onResize={() => {
            setIsCollapsed(false)
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(false)}`
          }}
          className={cn(isCollapsed && "w-full transition-all duration-300 ease-in-out")}
        >
          <div
            className={cn(
              "flex h-[52px] items-center justify-center",
              isCollapsed ? "h-[52px]" : "px-2"
            )}
          >
            <AccountSwitcher isCollapsed={isCollapsed} account={account} />
          </div>
          <Separator className="mx-0" />

          {/* Capture, rather than compose. New conversations start as leads. */}
          <div className="m-3">
            <Button asChild className="w-full cursor-pointer">
              <Link href="/leads/new">
                {isCollapsed ? "" : "Capture lead"}
                <Users2 className="size-4" />
              </Link>
            </Button>
          </div>
          <Separator className="mx-0" />

          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: FOLDER_LABEL.all,
                label: counts.all ? String(counts.all) : "",
                icon: Inbox,
                variant: folder === "all" ? "default" : "ghost",
                onClick: () => setFolder("all"),
              },
              {
                title: FOLDER_LABEL.website,
                label: counts.website ? String(counts.website) : "",
                icon: Globe,
                variant: folder === "website" ? "default" : "ghost",
                onClick: () => setFolder("website"),
              },
              {
                title: FOLDER_LABEL.direct,
                label: directCount ? String(directCount) : "",
                icon: Phone,
                variant: folder === "direct" ? "default" : "ghost",
                onClick: () => setFolder("direct"),
              },
            ]}
          />
          <Separator className="mx-0" />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: FOLDER_LABEL.answered,
                label: counts.answered ? String(counts.answered) : "",
                icon: CheckCheck,
                variant: folder === "answered" ? "default" : "ghost",
                onClick: () => setFolder("answered"),
              },
              {
                title: FOLDER_LABEL.overdue,
                label: counts.overdue ? String(counts.overdue) : "",
                icon: AlertTriangle,
                variant: folder === "overdue" ? "default" : "ghost",
                onClick: () => setFolder("overdue"),
              },
            ]}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
          <Tabs defaultValue="all" className="gap-1">
            <div className="flex items-center px-4 py-1.5">
              <h1 className="text-foreground text-xl font-bold">
                {FOLDER_LABEL[folder]}
              </h1>
              <TabsList className="ml-auto">
                <TabsTrigger value="all" className="cursor-pointer">All</TabsTrigger>
                <TabsTrigger value="unread" className="cursor-pointer">Unanswered</TabsTrigger>
              </TabsList>
            </div>
            <Separator />
            <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 p-4 backdrop-blur">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2 size-4" />
                <Input
                  placeholder="Search enquiries"
                  className="pl-8 cursor-text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            <TabsContent value="all" className="m-0">
              <MailList items={visible} empty={emptyFor(folder, query)} />
            </TabsContent>
            <TabsContent value="unread" className="m-0">
              <MailList
                items={visible.filter((item) => !item.read)}
                empty="Nothing here is waiting on a first response."
              />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
          <MailDisplay mail={selected} mailConfigured={mailConfigured} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  )
}

/** Says why the list is empty, which is usually the more useful fact. */
function emptyFor(folder: Folder, query: string): string {
  if (query.trim()) return "No enquiry matches that search."

  switch (folder) {
    case "website":
      return "Nothing has come in through the website form yet."
    case "direct":
      return "No enquiries captured by hand yet."
    case "answered":
      return "No follow-ups have been sent yet."
    case "overdue":
      return "Nothing has breached its first-response target. Good."
    case "all":
      return "No enquiries yet. Capture one, or submit the form on the website."
  }
}
