import "server-only";
import { hmacSha256Hex } from "../crypto";
import { PermanentJobError } from "../jobs/queue";

/** Rejects URLs that point at private networks (SSRF protection for user-supplied webhook URLs). */
export function assertSafeWebhookUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new PermanentJobError("Webhook URL is not valid");
  }
  if (u.protocol !== "https:") throw new PermanentJobError("Webhook URL must start with https://");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(10|127|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host.startsWith("[") // raw IPv6 literals
  ) {
    throw new PermanentJobError("Webhook URL must be a public internet address");
  }
  return u;
}

/**
 * POSTs JSON with an HMAC-SHA256 signature header so receivers can verify it:
 *   X-ViewEstimate-Signature: t=<unix>,v1=<hex hmac of "<t>.<body>">
 */
export async function postSignedJson(url: string, secret: string | null, body: unknown, deliveryId: string, event = "lead.created") {
  const u = assertSafeWebhookUrl(url);
  const json = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ViewEstimate-Webhooks/1.0",
    "X-ViewEstimate-Event": event,
    "X-ViewEstimate-Delivery": deliveryId,
  };
  if (secret) headers["X-ViewEstimate-Signature"] = `t=${t},v1=${hmacSha256Hex(secret, `${t}.${json}`)}`;
  const res = await fetch(u, { method: "POST", headers, body: json, redirect: "manual", signal: AbortSignal.timeout(10000) });
  const text = (await res.text().catch(() => "")).slice(0, 500);
  if (res.status >= 200 && res.status < 300) return { status: res.status, body: text };
  if (res.status === 408 || res.status === 429 || res.status >= 500) throw new Error(`Webhook returned ${res.status}: ${text}`);
  throw new PermanentJobError(`Webhook returned ${res.status}: ${text}`);
}
