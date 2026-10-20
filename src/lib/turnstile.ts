import "server-only";
import { env } from "./env";

/** Verifies a Cloudflare Turnstile token. Local dev passes when it isn't configured; production does not. */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!env.turnstileSecret) return !env.runtimeProduction;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.turnstileSecret, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}
