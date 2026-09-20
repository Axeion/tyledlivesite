import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

/**
 * Minimal transactional mailer. With SMTP_URL set (e.g.
 * smtp://user:pass@smtp.example.org:587) mail is sent through nodemailer;
 * otherwise messages are logged to stdout so development never needs an SMTP
 * server. Failures are logged and never break the calling flow.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = process.env.SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

export async function sendMail(mail: Mail): Promise<void> {
  const from = process.env.MAIL_FROM ?? `Tyled.Live <no-reply@${env.platformDomain}>`;
  const t = getTransporter();
  if (!t) {
    console.log(`[mail] (not sent, SMTP_URL unset) to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return;
  }
  try {
    await t.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text });
  } catch (err) {
    console.error(`[mail] failed to send to ${mail.to}:`, err);
  }
}

/** Platform addresses that should hear about new submissions (ADMIN_NOTIFY_EMAILS, comma separated). */
export function adminNotifyEmails(): string[] {
  return (process.env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
