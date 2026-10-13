import { z } from "zod";
import { apiError, handler, json, parseJson } from "@/lib/api";
import { getPropertyProvider } from "@/lib/property/provider";
import { publicGuard, type SlugCtx } from "@/lib/public-api";
import { reportError } from "@/lib/monitoring";
import { addUsage } from "@/lib/usage";

const schema = z.object({ input: z.string().trim().min(3).max(200), sessionToken: z.string().min(8).max(100) });

export const POST = handler(async (req: Request, ctx: SlugCtx) => {
  const g = await publicGuard(req, ctx, "ac", { perIpPerMin: 90, perBusinessPerDay: 20000 });
  if (!g.ok) return g.res;
  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;
  const provider = getPropertyProvider();
  const area = g.business.serviceArea;
  try {
    const suggestions = await provider.autocomplete(
      body.data.input,
      body.data.sessionToken,
      area.center ? { lat: area.center.lat, lng: area.center.lng, radiusMiles: area.radiusMiles } : undefined,
    );
    if (!provider.simulated) await addUsage("places_autocomplete", g.business.id);
    return json({ suggestions: suggestions.slice(0, 5) });
  } catch (e) {
    reportError(e, { where: "autocomplete", business: g.business.slug });
    return apiError(502, "Address search is unavailable. Enter your address manually.");
  }
});
