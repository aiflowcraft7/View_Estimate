import { eq } from "drizzle-orm";
import { z } from "zod";
import { handler, json, parseJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { propertiesCache } from "@/lib/db/schema";
import { selectionsSchema } from "@/lib/pricing/schema";
import { buildPropertyFacts } from "@/lib/property/facts";
import { inServiceArea } from "@/lib/property/service-area";
import { publicGuard, type SlugCtx } from "@/lib/public-api";
import { monthlyQuoteCount, saveQuote, trackEvent } from "@/lib/quotes";

const schema = z.object({
  sessionId: z.string().max(100).optional(),
  channel: z.enum(["widget", "hosted", "qr", "preview"]).default("widget"),
  placeId: z.string().max(500).optional(),
  address: z.string().trim().max(300).optional(),
  stories: z.number().int().min(1).max(10),
  livingSqft: z.number().positive().max(100000).nullable().optional(),
  sizeSource: z.enum(["solar", "manual", "band", "none"]),
  siding: z.enum(["vinyl", "brick", "hardie", "stucco"]).nullable().optional(),
  staining: z.boolean().optional(),
  neglectedGutters: z.boolean().optional(),
  selections: selectionsSchema,
  referrer: z.string().max(500).optional(),
  utm: z.record(z.string().max(40), z.string().max(200)).optional(),
});

export const POST = handler(async (req: Request, ctx: SlugCtx) => {
  const g = await publicGuard(req, ctx, "quote", { perIpPerMin: 30, perBusinessPerDay: 5000 });
  if (!g.ok) return g.res;
  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;
  const d = body.data;

  // Measurements come from our own cache (filled by /lookup), never from the browser.
  let cached: typeof propertiesCache.$inferSelect | undefined;
  if (d.placeId) {
    const db = await getDb();
    [cached] = await db.select().from(propertiesCache).where(eq(propertiesCache.placeId, d.placeId)).limit(1);
  }
  const property = buildPropertyFacts(
    cached ? { footprintSqft: cached.footprintSqft, roofSqft: cached.roofSqft, perimeterFt: cached.perimeterFt, roofPitchDegrees: cached.roofPitchAvg } : null,
    { stories: d.stories, livingSqft: d.livingSqft, source: d.sizeSource, siding: d.siding, staining: d.staining, neglectedGutters: d.neglectedGutters },
  );

  const zip = cached?.zip ?? d.address?.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null;
  const overCap = (await monthlyQuoteCount(g.business.id)) >= g.business.monthlyQuoteCap;
  const q = await saveQuote({
    business: g.business,
    sessionId: d.sessionId,
    placeId: cached?.placeId ?? null,
    address: cached?.formattedAddress ?? d.address ?? null,
    zip,
    lat: cached?.lat ?? null,
    lng: cached?.lng ?? null,
    property,
    selections: d.selections,
    channel: d.channel,
    referrer: d.referrer ?? req.headers.get("referer"),
    utm: d.utm ?? null,
  });
  if (d.channel !== "preview") await trackEvent(g.business.id, "quote", d.sessionId, d.channel);

  const inArea = inServiceArea(g.business.serviceArea, { zip, lat: cached?.lat, lng: cached?.lng });
  const showPrice = g.business.mode === "full" && !overCap && inArea;
  return json({ quoteId: q.id, showPrice, inArea, result: showPrice ? q.result : null, property });
});
