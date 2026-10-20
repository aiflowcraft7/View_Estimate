import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getSubscription } from "./business";
import { FREE_LEADS, widgetMode, type FreeStart, type WidgetMode } from "./billing/plans";
import { getDb } from "./db";
import { auditLog, businesses, leads, quotes, widgetEvents, type QuoteChannel } from "./db/schema";
import { env } from "./env";
import { enqueue } from "./jobs/queue";
import { sendEmail } from "./messaging/email";
import { simpleEmail } from "./messaging/templates";
import { priceQuote } from "./pricing/engine";
import type { PropertyFacts, QuoteResult, ServiceSelection } from "./pricing/types";

export type PublicBusiness = typeof businesses.$inferSelect & { mode: WidgetMode };

/** Lead count plus the timestamp of the lead that used up the free allotment. */
export async function freeLeadUsage(businessId: string): Promise<Required<FreeStart>> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.businessId, businessId));
  const leadCount = row?.n ?? 0;
  if (leadCount < FREE_LEADS) return { leadCount, thirdLeadAt: null };
  const ranked = await db
    .select({ createdAt: leads.createdAt })
    .from(leads)
    .where(eq(leads.businessId, businessId))
    .orderBy(asc(leads.createdAt))
    .limit(FREE_LEADS);
  return { leadCount, thirdLeadAt: ranked[FREE_LEADS - 1]?.createdAt ?? null };
}

export async function getPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  const db = await getDb();
  const [b] = await db.select().from(businesses).where(eq(businesses.slug, slug.toLowerCase())).limit(1);
  if (!b) return null;
  const sub = await getSubscription(b.id);
  const free = await freeLeadUsage(b.id);
  return { ...b, mode: widgetMode(b, sub, new Date(), free) };
}

/** Public widget config: only what the browser needs, never contact details or internals. */
export function publicConfig(b: PublicBusiness) {
  return {
    slug: b.slug,
    name: b.name,
    logoUrl: b.logoUrl,
    brandColor: b.brandColor,
    phone: b.phone,
    headline: b.headline,
    mode: b.mode,
    poweredByHidden: b.poweredByHidden,
    serviceArea: { hasArea: !!(b.serviceArea.zips?.length || b.serviceArea.radiusMiles) },
    pricing: b.pricing,
  };
}

export async function monthlyQuoteCount(businessId: string): Promise<number> {
  const db = await getDb();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quotes)
    .where(and(eq(quotes.businessId, businessId), gte(quotes.createdAt, start)));
  return r?.n ?? 0;
}

export async function saveQuote(input: {
  business: PublicBusiness;
  sessionId?: string | null;
  placeId?: string | null;
  address?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  property: PropertyFacts;
  selections: ServiceSelection[];
  channel: QuoteChannel;
  referrer?: string | null;
  utm?: Record<string, string> | null;
}): Promise<{ id: string; result: QuoteResult }> {
  // Always recalculate on the server; the browser's price is never trusted.
  const result = priceQuote(input.business.pricing, input.property, input.selections);
  const db = await getDb();
  const [row] = await db
    .insert(quotes)
    .values({
      businessId: input.business.id,
      sessionId: input.sessionId ?? null,
      placeId: input.placeId ?? null,
      address: input.address ?? null,
      zip: input.zip ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      property: input.property,
      selections: input.selections,
      result,
      total: result.total,
      displayMode: result.displayMode,
      channel: input.channel,
      referrer: input.referrer ?? null,
      utm: input.utm ?? null,
    })
    .returning({ id: quotes.id });
  return { id: row.id, result };
}

export async function trackEvent(businessId: string, event: "view" | "address" | "quote" | "lead", sessionId?: string | null, channel?: string | null) {
  const db = await getDb();
  await db.insert(widgetEvents).values({ businessId, event, sessionId: sessionId ?? null, channel: channel ?? null });
}

export type NewLead = {
  business: PublicBusiness;
  quoteId: string | null;
  name: string;
  phone: string;
  email: string;
  notes?: string | null;
  preferredWindow?: string | null;
  photos?: string[];
  address?: string | null;
  total?: number | null;
  smsConsent: boolean;
  consentText?: string | null;
  ip?: string | null;
};

/** Stores the lead and queues owner alerts, the homeowner confirmation and CRM sync. */
export async function createLead(input: NewLead) {
  const db = await getDb();
  const [lead] = await db
    .insert(leads)
    .values({
      businessId: input.business.id,
      quoteId: input.quoteId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      notes: input.notes?.trim() || null,
      preferredWindow: input.preferredWindow?.trim() || null,
      photos: input.photos ?? [],
      address: input.address ?? null,
      total: input.total ?? null,
      smsConsent: input.smsConsent,
      consentText: input.smsConsent ? (input.consentText ?? null) : null,
      consentAt: input.smsConsent ? new Date() : null,
      consentIp: input.smsConsent ? (input.ip ?? null) : null,
    })
    .returning();

  const jobIds = [
    await enqueue("lead.alert", { leadId: lead.id }, { businessId: input.business.id }),
    await enqueue("lead.confirmation", { leadId: lead.id }, { businessId: input.business.id, maxAttempts: 4 }),
  ];
  const { enqueueCrmSync } = await import("./integrations/sync");
  jobIds.push(...(await enqueueCrmSync(input.business.id, lead.id)));
  await notifyFreeLeadsUsed(input.business.id, input.business.alertEmail);
  return { lead, jobIds };
}

/** One email when the free allotment is used and there is no paid subscription. */
async function notifyFreeLeadsUsed(businessId: string, alertEmail: string | null) {
  if (!alertEmail) return;
  const usage = await freeLeadUsage(businessId);
  if (usage.leadCount !== FREE_LEADS) return;
  const sub = await getSubscription(businessId);
  if (sub && ["active", "trialing", "past_due"].includes(sub.status)) return;
  const db = await getDb();
  const [done] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.businessId, businessId), eq(auditLog.action, "email.free_leads_used")))
    .limit(1);
  if (done) return;
  const sent = await sendEmail(
    simpleEmail(
      alertEmail,
      "Your 3 free leads are in",
      [
        "Those first 3 leads were on us.",
        "Pick Starter or Pro to keep instant prices on your website. If you don't, your widget keeps collecting requests, just without prices.",
      ],
      { url: `${env.appUrl}/app/billing`, label: "Choose a plan" },
    ),
  );
  if (sent.ok) await db.insert(auditLog).values({ businessId, action: "email.free_leads_used" });
}
