import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { auditLog, integrations, leads, quotes, widgetEvents } from "./db/schema";

export async function funnel(businessId: string, days = 30) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86400_000);
  const ev = await db
    .select({ event: widgetEvents.event, n: sql<number>`count(distinct coalesce(${widgetEvents.sessionId}, ${widgetEvents.id}::text))::int` })
    .from(widgetEvents)
    .where(and(eq(widgetEvents.businessId, businessId), gte(widgetEvents.createdAt, since)))
    .groupBy(widgetEvents.event);
  const get = (e: string) => ev.find((x) => x.event === e)?.n ?? 0;
  const [l] = await db
    .select({
      leads: sql<number>`count(*)::int`,
      booked: sql<number>`count(*) filter (where ${leads.status} = 'booked')::int`,
      bookedValue: sql<number>`coalesce(sum(coalesce(${leads.bookedValue}, ${leads.total})) filter (where ${leads.status} = 'booked'), 0)::float`,
      quotedValue: sql<number>`coalesce(sum(${leads.total}), 0)::float`,
    })
    .from(leads)
    .where(and(eq(leads.businessId, businessId), gte(leads.createdAt, since)));
  return {
    views: get("view"),
    addresses: get("address"),
    quotes: get("quote"),
    leads: l?.leads ?? 0,
    booked: l?.booked ?? 0,
    bookedValue: l?.bookedValue ?? 0,
    quotedValue: l?.quotedValue ?? 0,
  };
}

export async function topServices(businessId: string, days = 30) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select({ result: quotes.result })
    .from(leads)
    .innerJoin(quotes, eq(quotes.id, leads.quoteId))
    .where(and(eq(leads.businessId, businessId), gte(leads.createdAt, since)))
    .limit(2000);
  const counts = new Map<string, number>();
  for (const r of rows) for (const l of r.result.lines) counts.set(l.name, (counts.get(l.name) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export async function setupChecklist(b: { id: string; alertEmail: string | null }, hasSubscription: boolean) {
  const db = await getDb();
  const [view] = await db.select({ id: widgetEvents.id }).from(widgetEvents).where(and(eq(widgetEvents.businessId, b.id), eq(widgetEvents.event, "view"))).orderBy(desc(widgetEvents.id)).limit(1);
  const [integ] = await db.select({ id: integrations.id }).from(integrations).where(eq(integrations.businessId, b.id)).limit(1);
  const [priced] = await db.select({ id: auditLog.id }).from(auditLog).where(and(eq(auditLog.businessId, b.id), eq(auditLog.action, "pricing.save"))).limit(1);
  return [
    { done: !!priced, label: "Review your prices", href: "/app/pricing" },
    { done: !!view, label: "Put the quote widget on your website", href: "/app/install" },
    { done: !!b.alertEmail, label: "Set where lead alerts go", href: "/app/settings" },
    { done: !!integ, label: "Connect your CRM (optional)", href: "/app/integrations" },
    { done: hasSubscription, label: "Choose a plan", href: "/app/billing" },
  ];
}
