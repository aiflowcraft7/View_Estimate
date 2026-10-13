import "server-only";
import { and, eq, inArray, lte, or, sql, isNull, lt } from "drizzle-orm";
import { getDb } from "../db";
import { jobs } from "../db/schema";
import { reportError } from "../monitoring";

export type JobContext = { id: string; attempt: number; isLastAttempt: boolean; businessId: string | null };
export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<unknown>;

/** Thrown by a handler for failures that retrying will never fix (bad config, 4xx). */
export class PermanentJobError extends Error {}

const handlers = new Map<string, JobHandler>();

export function registerJob(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

export async function enqueue(
  type: string,
  payload: Record<string, unknown>,
  opts: { businessId?: string | null; runAt?: Date; maxAttempts?: number } = {},
): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .insert(jobs)
    .values({ type, payload, businessId: opts.businessId ?? null, runAt: opts.runAt ?? new Date(), maxAttempts: opts.maxAttempts ?? 6 })
    .returning({ id: jobs.id });
  return row.id;
}

/** Exponential backoff: 30s, 1m, 2m, 4m... capped at 6h. */
export function backoffMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 6 * 3600_000);
}

/**
 * Claims and runs due jobs. Safe to call concurrently (row locks with SKIP
 * LOCKED, plus a lease so a crashed run is picked up again after 5 minutes).
 */
export async function runDueJobs(opts: { limit?: number; ids?: string[] } = {}): Promise<{ ran: number; failed: number }> {
  const { ensureHandlers } = await import("./handlers");
  ensureHandlers();
  const db = await getDb();
  const limit = opts.limit ?? 25;
  const now = new Date();
  const lease = new Date(now.getTime() + 5 * 60_000);

  const due = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "pending"),
        lte(jobs.runAt, now),
        or(isNull(jobs.lockedUntil), lt(jobs.lockedUntil, now)),
        opts.ids?.length ? inArray(jobs.id, opts.ids) : undefined,
      ),
    )
    .orderBy(jobs.runAt)
    .limit(limit)
    .for("update", { skipLocked: true });

  const claimed = await db
    .update(jobs)
    .set({ lockedUntil: lease, attempts: sql`${jobs.attempts} + 1`, updatedAt: now })
    .where(inArray(jobs.id, due))
    .returning();

  let failed = 0;
  for (const job of claimed) {
    const handler = handlers.get(job.type);
    try {
      if (!handler) throw new PermanentJobError(`No handler for job type ${job.type}`);
      const result = await handler(job.payload, { id: job.id, attempt: job.attempts, isLastAttempt: job.attempts >= job.maxAttempts, businessId: job.businessId });
      await db
        .update(jobs)
        .set({ status: "done", result: (result ?? null) as object | null, lockedUntil: null, lastError: null, updatedAt: new Date() })
        .where(eq(jobs.id, job.id));
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      const dead = e instanceof PermanentJobError || job.attempts >= job.maxAttempts;
      await db
        .update(jobs)
        .set({
          status: dead ? "dead" : "pending",
          payload: job.payload, // handlers may record partial progress (e.g. which channels already sent)
          lastError: msg.slice(0, 2000),
          lockedUntil: null,
          runAt: dead ? job.runAt : new Date(Date.now() + backoffMs(job.attempts)),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
      if (dead) reportError(e, { job: job.type, jobId: job.id, businessId: job.businessId });
    }
  }
  return { ran: claimed.length, failed };
}

/** Admin: put a dead job back in the queue. */
export async function retryJob(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(jobs)
    .set({ status: "pending", runAt: new Date(), maxAttempts: sql`${jobs.attempts} + 3`, lockedUntil: null, updatedAt: new Date() })
    .where(eq(jobs.id, id));
}
