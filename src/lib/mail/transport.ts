import nodemailer, { type Transporter } from "nodemailer"

/**
 * Outbound email.
 *
 * One Gmail account, connected over SMTP with an app password. That is a
 * deliberate choice over a transactional provider: the address that receives
 * website enquiries and the address that answers them are the same mailbox, so
 * a reply the assistant sends lands in Sent alongside everything typed by hand,
 * and a customer replying to it arrives in the same inbox as everything else.
 *
 * A provider like Resend would deliver better at volume and is the right move
 * once volume exists. It would also mean sent mail living somewhere nobody
 * looks.
 *
 * The rest of the app treats sending as something that can fail and says so.
 * Nothing here ever returns a success it did not get from the SMTP server —
 * `sentProvider` / `sentProviderMessageId` in the database are proof of
 * delivery, and inventing them would corrupt the one record that distinguishes
 * "sent" from "we think we sent".
 */

export type MailResult =
  | { ok: true; provider: string; messageId: string; accepted: string[] }
  | { ok: false; reason: string; configured: boolean }

export interface MailMessage {
  to: string
  subject: string
  text: string
  /** Where a human reply should go. Defaults to the connected mailbox. */
  replyTo?: string
  /** Shown to the recipient instead of the raw address. */
  fromName?: string
}

interface MailConfig {
  user: string
  password: string
  fromName: string
  /** Where website enquiry notifications are delivered. */
  inbox: string
  host: string
  port: number
}

function env(name: string): string {
  return process.env[name]?.trim() ?? ""
}

/**
 * Reads the mailbox settings, or explains what is missing.
 *
 * Returns the reason rather than throwing, because every caller wants to carry
 * on without email rather than fail the operation it was really doing — a lead
 * must still be captured when the mail server is unreachable.
 */
export function mailConfig(): { ok: true; config: MailConfig } | { ok: false; reason: string } {
  const user = env("GMAIL_USER")

  /**
   * Google displays an app password as four space-separated groups — "abcd
   * efgh ijkl mnop" — and the natural thing to do is paste exactly that. SMTP
   * wants the sixteen characters with no spaces, and the failure if you get it
   * wrong is an opaque "535 Username and Password not accepted", which reads
   * like the password is wrong rather than merely punctuated.
   *
   * So strip the whitespace here rather than making a person notice it.
   */
  const password = env("GMAIL_APP_PASSWORD").replace(/\s+/g, "")

  if (!user) {
    return {
      ok: false,
      reason: "GMAIL_USER is not set, so no mailbox is connected.",
    }
  }
  if (!password) {
    return {
      ok: false,
      reason:
        "GMAIL_APP_PASSWORD is not set. Gmail rejects account passwords over " +
        "SMTP — generate an app password at myaccount.google.com/apppasswords.",
    }
  }

  return {
    ok: true,
    config: {
      user,
      password,
      fromName: env("MAIL_FROM_NAME") || "Brightpath Solutions",
      inbox: env("MAIL_INBOX") || user,
      host: env("SMTP_HOST") || "smtp.gmail.com",
      port: Number(env("SMTP_PORT")) || 465,
    },
  }
}

/** True when a real send is possible. Used to label UI, never to fake one. */
export function isMailConfigured(): boolean {
  return mailConfig().ok
}

/** The address website enquiries are copied to. Null when unconfigured. */
export function notificationInbox(): string | null {
  const resolved = mailConfig()
  return resolved.ok ? resolved.config.inbox : null
}

/**
 * Cached across requests.
 *
 * Nodemailer pools connections, and on a serverless host a new transport per
 * send means a fresh TLS handshake and Gmail login every time — slow enough to
 * be noticeable inside a form submission, and enough repeated logins to look
 * like something worth rate-limiting.
 */
let cached: { key: string; transporter: Transporter } | null = null

function transporterFor(config: MailConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.user}`
  if (cached?.key === key) return cached.transporter

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
    pool: true,
    maxConnections: 2,
  })

  cached = { key, transporter }
  return transporter
}

/**
 * Send one message.
 *
 * Never throws. A caller that cannot send should carry on and report it, not
 * lose the work it was in the middle of.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const resolved = mailConfig()
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, configured: false }
  }

  const { config } = resolved
  const recipient = message.to.trim()
  if (!recipient) {
    return { ok: false, reason: "No recipient address.", configured: true }
  }

  try {
    const info = await transporterFor(config).sendMail({
      from: `"${message.fromName ?? config.fromName}" <${config.user}>`,
      to: recipient,
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo ?? config.user,
    })

    const accepted = (info.accepted ?? []).map(String)

    // Gmail can accept the connection and still refuse a recipient. Treat an
    // empty accepted list as a failure rather than reporting a phantom send.
    if (accepted.length === 0) {
      return {
        ok: false,
        reason: `The mail server accepted no recipients for ${recipient}.`,
        configured: true,
      }
    }

    return {
      ok: true,
      provider: "gmail",
      messageId: info.messageId,
      accepted,
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The mail server refused the message.",
      configured: true,
    }
  }
}
