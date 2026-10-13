import { z } from "zod";
import { apiError, handler, json, parseJson } from "@/lib/api";
import { getBusinessContext } from "@/lib/auth";
import { getPropertyProvider } from "@/lib/property/provider";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ input: z.string().trim().min(3).max(200), sessionToken: z.string().min(8).max(100) });

export const POST = handler(async (req: Request) => {
  const ctx = await getBusinessContext();
  if (!ctx) return apiError(401, "Sign in");
  if (!(await rateLimit(`app:places:${ctx.user.id}`, 60, 60))) return apiError(429, "Slow down");
  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;
  const suggestions = await getPropertyProvider().autocomplete(body.data.input, body.data.sessionToken);
  return json({ suggestions: suggestions.slice(0, 5) });
});
