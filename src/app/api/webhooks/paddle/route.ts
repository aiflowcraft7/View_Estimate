import { applyPaddleEvent, verifyPaddleSignature, type PaddleEvent } from "@/lib/billing/paddle";
import { env } from "@/lib/env";
import { reportError } from "@/lib/monitoring";

export async function POST(req: Request) {
  const secret = env.paddleWebhookSecret;
  if (!secret) return new Response("Paddle not configured", { status: 503 });
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get("paddle-signature"), secret)) return new Response("Invalid signature", { status: 401 });
  try {
    const result = await applyPaddleEvent(JSON.parse(raw) as PaddleEvent);
    return Response.json({ ok: true, result });
  } catch (e) {
    reportError(e, { where: "paddle-webhook" });
    // 500 makes Paddle retry later.
    return new Response("Error", { status: 500 });
  }
}
