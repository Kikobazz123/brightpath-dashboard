import { fetchInbox } from "@/lib/client/server-data"
import { isMailConfigured, notificationInbox } from "@/lib/mail/transport"

import { Mail } from "./components/mail"
import { inboxAccount, inboxCounts, toInboxMessages } from "./inbox-data"

/**
 * The Inbox.
 *
 * A server component now, because the messages are rows in the database rather
 * than a hard-coded array. `force-dynamic` for the same reason the lead pages
 * are: an inbox that is a build artefact is not an inbox.
 */
export const dynamic = "force-dynamic"

export default async function MailPage() {
  const leads = await fetchInbox()
  const messages = toInboxMessages(leads)

  return (
    <div className="@container/main flex flex-1 flex-col">
      <div className="h-[calc(100vh-4rem)] px-4 md:px-6">
        <Mail
          account={{
            ...inboxAccount,
            // The address enquiries are actually delivered to, when one is
            // configured. Falls back to the brand address so the switcher is
            // never blank, but the two can differ and the header says which.
            email: notificationInbox() ?? inboxAccount.email,
          }}
          mailConfigured={isMailConfigured()}
          messages={messages}
          counts={inboxCounts(messages)}
          defaultLayout={[20, 32, 48]}
          defaultCollapsed={false}
          navCollapsedSize={4}
        />
      </div>
    </div>
  )
}
