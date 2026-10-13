import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { verifyTwilio } from "@/lib/twilio-verify";

/** Delivery receipts: marks alerts that carriers rejected as failed so they show in the lead activity. */
export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  if (!env.twilioToken || !verifyTwilio(env.twilioToken, `${env.appUrl}/api/webhooks/twilio/status`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const sid = params.get("MessageSid");
  const status = params.get("MessageStatus");
  if (sid && (status === "failed" || status === "undelivered")) {
    const db = await getDb();
    await db
      .update(notifications)
      .set({ status: "failed", error: `Carrier: ${status}${params.get("ErrorCode") ? ` (${params.get("ErrorCode")})` : ""}` })
      .where(eq(notifications.providerId, sid));
  }
  return new Response(null, { status: 204 });
}
