import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { apiUsage } from "./db/schema";

export type UsageKind = "places_autocomplete" | "places_details" | "solar" | "sms_segments" | "email";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Adds to today's counter for this scope (a business id, or "global"). */
export async function addUsage(kind: UsageKind, scope: string, n = 1): Promise<void> {
  const db = await getDb();
  await db
    .insert(apiUsage)
    .values({ day: today(), kind, scope, count: n })
    .onConflictDoUpdate({ target: [apiUsage.day, apiUsage.kind, apiUsage.scope], set: { count: sql`${apiUsage.count} + ${n}` } });
}

export async function usageToday(kind: UsageKind, scope: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ count: apiUsage.count })
    .from(apiUsage)
    .where(and(eq(apiUsage.day, today()), eq(apiUsage.kind, kind), eq(apiUsage.scope, scope)));
  return rows[0]?.count ?? 0;
}
