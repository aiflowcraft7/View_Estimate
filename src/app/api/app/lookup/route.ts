import { z } from "zod";
import { apiError, handler, json, parseJson } from "@/lib/api";
import { getBusinessContext } from "@/lib/auth";
import { lookupProperty } from "@/lib/property/lookup";
import { inServiceArea } from "@/lib/property/service-area";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ placeId: z.string().min(3).max(500), sessionToken: z.string().max(100).optional() });

export const POST = handler(async (req: Request) => {
  const ctx = await getBusinessContext();
  if (!ctx) return apiError(401, "Sign in");
  if (!(await rateLimit(`app:lookup:${ctx.user.id}`, 30, 60))) return apiError(429, "Slow down");
  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;
  const r = await lookupProperty(body.data.placeId, body.data.sessionToken, ctx.business.id);
  if (!r.ok) return json({ found: false, reason: r.reason });
  return json({ found: true, property: r.property, inArea: inServiceArea(ctx.business.serviceArea, r.property) });
});
