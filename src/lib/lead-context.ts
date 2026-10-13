import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { businesses, leads, quotes } from "./db/schema";
import { env } from "./env";
import { buildLeadPayload } from "./integrations/payload";
import { PermanentJobError } from "./jobs/queue";
import { priceText } from "./messaging/templates";
import { signedFileUrl } from "./storage";

/** Loads a lead with its quote and business, plus the derived payload used by alerts and CRMs. */
export async function loadLeadContext(leadId: string) {
  const db = await getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new PermanentJobError(`Lead ${leadId} not found`);
  const [business] = await db.select().from(businesses).where(eq(businesses.id, lead.businessId)).limit(1);
  if (!business) throw new PermanentJobError(`Business for lead ${leadId} not found`);
  const quote = lead.quoteId ? ((await db.select().from(quotes).where(eq(quotes.id, lead.quoteId)).limit(1))[0] ?? null) : null;
  const leadUrl = `${env.appUrl}/app/leads/${lead.id}`;
  const price = quote ? priceText(quote.result) : lead.total != null ? `$${lead.total}` : "Price to be confirmed";
  const payload = buildLeadPayload({
    lead,
    quote: quote ? { id: quote.id, result: quote.result, property: quote.property } : null,
    business: { id: business.id, name: business.name, slug: business.slug },
    leadUrl,
    priceText: price,
    photoUrls: lead.photos.map((p) => signedFileUrl(p)),
  });
  return { lead, business, quote, leadUrl, price, payload };
}
