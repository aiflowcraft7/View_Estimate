import "server-only";
import { apiError } from "./api";
import { clientIp, rateLimit } from "./ratelimit";
import { getPublicBusiness, type PublicBusiness } from "./quotes";

export type SlugCtx = { params: Promise<{ slug: string }> };

/** Loads the business for a public endpoint and applies per-IP and per-business rate limits. */
export async function publicGuard(
  req: Request,
  ctx: SlugCtx,
  name: string,
  limits: { perIpPerMin: number; perBusinessPerDay: number },
): Promise<{ ok: true; business: PublicBusiness; ip: string } | { ok: false; res: Response }> {
  const { slug } = await ctx.params;
  const ip = clientIp(req.headers);
  if (!(await rateLimit(`ip:${name}:${ip}`, limits.perIpPerMin, 60))) return { ok: false, res: apiError(429, "Too many requests. Please wait a minute.") };
  const business = await getPublicBusiness(slug);
  if (!business) return { ok: false, res: apiError(404, "Not found") };
  if (!(await rateLimit(`biz:${name}:${business.id}`, limits.perBusinessPerDay, 86400))) return { ok: false, res: apiError(429, "This quote form is busy. Please try again later.") };
  return { ok: true, business, ip };
}
