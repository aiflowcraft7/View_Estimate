import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { devOutbox, optOuts } from "../db/schema";
import { env } from "../env";
import type { SendResult } from "./email";

/** Normalizes a US phone number to E.164 (+1XXXXXXXXXX). Returns null when invalid. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits[1])) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function smsLive(): boolean {
  return !!(env.twilioSid && env.twilioToken && env.twilioFrom);
}

/** GSM-7 messages split at 153 chars per segment, UCS-2 at 67. */
export function segmentCount(body: string): number {
  // eslint-disable-next-line no-control-regex
  const gsm = /^[\x0A\x0D\x20-\x7E£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà]*$/.test(body);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return body.length <= single ? 1 : Math.ceil(body.length / multi);
}

/** Sends through Twilio, or saves to the dev outbox when Twilio keys are missing. Honors STOP opt-outs. */
export async function sendSms(toRaw: string, body: string): Promise<SendResult & { segments?: number }> {
  const to = toE164(toRaw);
  if (!to) return { ok: false, error: "Invalid phone number", retryable: false };
  const db = await getDb();
  const opted = await db.select().from(optOuts).where(eq(optOuts.phone, to)).limit(1);
  if (opted.length) return { ok: false, error: "Recipient opted out (STOP)", retryable: false };
  const segments = segmentCount(body);

  if (!smsLive()) {
    const [row] = await db.insert(devOutbox).values({ channel: "sms", to, body }).returning({ id: devOutbox.id });
    console.info(`[sms:dev-outbox] to=${to} "${body.slice(0, 60)}"`);
    return { ok: true, id: row.id, simulated: true, segments };
  }

  const form = new URLSearchParams({ To: to, Body: body });
  if (env.twilioFrom!.startsWith("MG")) form.set("MessagingServiceSid", env.twilioFrom!);
  else form.set("From", env.twilioFrom!);
  if (env.appUrl.startsWith("https://")) form.set("StatusCallback", `${env.appUrl}/api/webhooks/twilio/status`);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) {
      // 21610 = recipient replied STOP. Record it so we never retry.
      if (json.code === 21610) await db.insert(optOuts).values({ phone: to }).onConflictDoNothing();
      return { ok: false, error: `Twilio ${res.status}: ${json.message ?? "error"}`, retryable: res.status === 429 || res.status >= 500 };
    }
    return { ok: true, id: json.sid ?? "", simulated: false, segments };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), retryable: true };
  }
}
