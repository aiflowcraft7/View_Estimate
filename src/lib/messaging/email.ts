import "server-only";
import { getDb } from "../db";
import { devOutbox } from "../db/schema";
import { env } from "../env";

export type EmailMessage = { to: string; subject: string; html: string; text: string; replyTo?: string };
export type SendResult = { ok: true; id: string; simulated: boolean } | { ok: false; error: string; retryable: boolean };

/** Sends through Resend, or saves to the dev outbox (/dev/outbox) when RESEND_API_KEY is missing. */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (!env.resendKey) {
    if (env.runtimeProduction) return { ok: false, error: "Email is not configured", retryable: false };
    const db = await getDb();
    const [row] = await db
      .insert(devOutbox)
      .values({ channel: "email", to: msg.to, subject: msg.subject, body: msg.text, html: msg.html })
      .returning({ id: devOutbox.id });
    console.info(`[email:dev-outbox] to=${msg.to} subject="${msg.subject}"`);
    return { ok: true, id: row.id, simulated: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.replyTo ? [msg.replyTo] : undefined,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${json.message ?? "error"}`, retryable: res.status === 429 || res.status >= 500 };
    return { ok: true, id: json.id ?? "", simulated: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), retryable: true };
  }
}
