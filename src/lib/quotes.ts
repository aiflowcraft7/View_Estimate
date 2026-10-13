import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getSubscription } from "./business";
import { widgetMode, type WidgetMode } from "./billing/plans";
import { getDb } from "./db";
import { businesses, leads, quotes, widgetEvents, type QuoteChannel } from "./db/schema";
import { enqueue } from "./jobs/queue";
import { priceQuote } from "./pricing/engine";
import type { PropertyFacts, QuoteResult, ServiceSelection } from "./pricing/types";

export type PublicBusiness = typeof businesses.$inferSelect & { mode: WidgetMode };

export async function getPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  const db = await getDb();
  const [b] = await db.select().from(businesses).where(eq(businesses.slug, slug.toLowerCase())).limit(1);
  if (!b) return null;
  const sub = await getSubscription(b.id);
  return { ...b, mode: widgetMode(b, sub) };
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
  return { lead, jobIds };
}
