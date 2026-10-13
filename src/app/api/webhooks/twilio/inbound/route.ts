import { getDb } from "@/lib/db";
import { optOuts } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { toE164 } from "@/lib/messaging/sms";
import { verifyTwilio } from "@/lib/twilio-verify";
import { eq } from "drizzle-orm";

const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|revoke|optout)\s*$/i;
const START = /^\s*(start|unstop|yes)\s*$/i;

/**
 * Incoming texts. Twilio's Advanced Opt-Out answers STOP/HELP itself; we also
 * record opt-outs so we never try to text that number again.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  if (!env.twilioToken || !verifyTwilio(env.twilioToken, `${env.appUrl}/api/webhooks/twilio/inbound`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const from = toE164(params.get("From"));
  const body = params.get("Body") ?? "";
  if (from) {
    const db = await getDb();
    if (STOP.test(body)) await db.insert(optOuts).values({ phone: from }).onConflictDoNothing();
    else if (START.test(body)) await db.delete(optOuts).where(eq(optOuts.phone, from));
  }
  return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
