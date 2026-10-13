import { z } from "zod";
import { handler, json, parseJson } from "@/lib/api";
import { publicGuard, type SlugCtx } from "@/lib/public-api";
import { trackEvent } from "@/lib/quotes";

const schema = z.object({ event: z.enum(["view"]), sessionId: z.string().max(100).optional(), channel: z.string().max(20).optional() });

/** Cookie-free funnel analytics. Only "view" comes from the browser; the server records the rest itself. */
export const POST = handler(async (req: Request, ctx: SlugCtx) => {
  const g = await publicGuard(req, ctx, "event", { perIpPerMin: 30, perBusinessPerDay: 50000 });
  if (!g.ok) return g.res;
  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;
  await trackEvent(g.business.id, body.data.event, body.data.sessionId, body.data.channel);
  return json({ ok: true });
});
