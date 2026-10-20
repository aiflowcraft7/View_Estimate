import "server-only";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { FREE_LEADS, FREE_WINDOW_DAYS } from "./billing/plans";
import { getDb } from "./db";
import { auditLog, businesses, leads, loginTokens, rateLimits, sessions, subscriptions } from "./db/schema";
import { env } from "./env";
import { sendEmail } from "./messaging/email";
import { simpleEmail, usd } from "./messaging/templates";
import { funnel, topServices } from "./stats";

/** Daily housekeeping: trial reminders, monthly owner reports, cleanup. Idempotent per day via audit_log markers. */
export async function runDaily(now = new Date()) {
  const db = await getDb();
  const out = { trialReminders: 0, monthlyReports: 0 };

  // 1) Free window ends in 3 days, still under 3 leads, no subscription yet.
  const remindDays = FREE_WINDOW_DAYS - 3;
  const from = new Date(now.getTime() - remindDays * 86400_000 - 86400_000);
  const to = new Date(now.getTime() - remindDays * 86400_000);
  const trials = await db
    .select({ b: businesses })
    .from(businesses)
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(and(eq(businesses.status, "trial"), isNull(subscriptions.businessId), gte(businesses.createdAt, from), lt(businesses.createdAt, to)));
  for (const { b } of trials) {
    if (!b.alertEmail || (await alreadyDone(b.id, "email.trial_reminder"))) continue;
    const [counted] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.businessId, b.id));
    if ((counted?.n ?? 0) >= FREE_LEADS) continue;
    const f = await funnel(b.id, FREE_WINDOW_DAYS);
    const r = await sendEmail(
      simpleEmail(
        b.alertEmail,
        "Your free start ends in 3 days",
        [
          `So far your quote page showed ${f.quotes} prices and brought in ${f.leads} lead${f.leads === 1 ? "" : "s"} worth ${usd(f.quotedValue)}. Your first ${FREE_LEADS} leads are free.`,
          "Pick a plan to keep instant prices on your website. If you don't, your widget keeps collecting requests, just without prices.",
        ],
        { url: `${env.appUrl}/app/billing`, label: "Choose a plan" },
      ),
    );
    if (r.ok) {
      await db.insert(auditLog).values({ businessId: b.id, action: "email.trial_reminder" });
      out.trialReminders++;
    }
  }

  // 2) Monthly results email on the 1st (for last month).
  if (now.getUTCDate() === 1) {
    const active = await db.select().from(businesses).where(sql`${businesses.status} in ('active','trial','past_due')`);
    for (const b of active) {
      const marker = `email.monthly_report.${now.toISOString().slice(0, 7)}`;
      if (!b.alertEmail || (await alreadyDone(b.id, marker))) continue;
      const days = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0).getDate();
      const f = await funnel(b.id, days);
      if (!f.views && !f.leads) continue;
      const top = await topServices(b.id, days);
      const r = await sendEmail(
        simpleEmail(
          b.alertEmail,
          `Your instant quotes last month: ${f.leads} lead${f.leads === 1 ? "" : "s"}`,
          [
            `${f.views} visits, ${f.quotes} prices shown, ${f.leads} leads, ${f.booked} marked booked (${usd(f.bookedValue)}).`,
            top.length ? `Most requested: ${top.map(([n, c]) => `${n} (${c})`).join(", ")}.` : "",
            "Tip: mark leads as Booked in your dashboard so these numbers stay accurate.",
          ].filter(Boolean),
          { url: `${env.appUrl}/app`, label: "Open dashboard" },
        ),
      );
      if (r.ok) {
        await db.insert(auditLog).values({ businessId: b.id, action: marker });
        out.monthlyReports++;
      }
    }
  }

  // 3) Cleanup.
  await db.delete(loginTokens).where(lt(loginTokens.expiresAt, new Date(now.getTime() - 86400_000)));
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 2 * 86400_000)));
  return out;
}

async function alreadyDone(businessId: string, action: string): Promise<boolean> {
  const db = await getDb();
  const [r] = await db.select({ id: auditLog.id }).from(auditLog).where(and(eq(auditLog.businessId, businessId), eq(auditLog.action, action))).limit(1);
  return !!r;
}
