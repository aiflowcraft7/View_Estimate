import "server-only";
import { env } from "./env";

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Without a secret, only local requests are allowed. */
export function cronAuthorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return !env.isProduction;
}
