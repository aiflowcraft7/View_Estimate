import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "./db/schema";

/**
 * Fixed-window rate limiter backed by Postgres, so it holds across serverless
 * instances. Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}::double precision) then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}::double precision) then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return (rows[0]?.count ?? 1) <= limit;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
