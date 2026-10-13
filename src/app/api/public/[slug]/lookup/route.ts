import { z } from "zod";
import { handler, json, parseJson } from "@/lib/api";
import { lookupProperty } from "@/lib/property/lookup";
import { inServiceArea } from "@/lib/property/service-area";
import { publicGuard, type SlugCtx } from "@/lib/public-api";
import { trackEvent } from "@/lib/quotes";

const schema = z.object({ placeId: z.string().min(3).max(500), sessionToken: z.string().max(100).optional(), sessionId: z.string().max(100).optional(), channel: z.string().max(20).optional() });

export const POST = handler(async (req: Request, ctx: SlugCtx) => {
  const g = await publicGuard(req, ctx, "lookup", { perIpPerMin: 20, perBusinessPerDay: 3000 });
  if (!g.ok) return g.res;
  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;
  const r = await lookupProperty(body.data.placeId, body.data.sessionToken, g.business.id);
  await trackEvent(g.business.id, "address", body.data.sessionId, body.data.channel);
  if (!r.ok) return json({ found: false, reason: r.reason });
  const p = r.property;
  return json({
    found: true,
    property: {
      placeId: p.placeId,
      address: p.formattedAddress,
      zip: p.zip,
      lat: p.lat,
      lng: p.lng,
      footprintSqft: p.footprintSqft,
      roofSqft: p.roofSqft,
      perimeterFt: p.perimeterFt,
      roofPitchDegrees: p.roofPitchAvg,
      source: p.source,
    },
    inArea: inServiceArea(g.business.serviceArea, p),
  });
});
