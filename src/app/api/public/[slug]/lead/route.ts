import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { apiError, handler, json } from "@/lib/api";
import { smsConsentText } from "@/lib/consent";
import { getDb } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { runDueJobs } from "@/lib/jobs/queue";
import { toE164 } from "@/lib/messaging/sms";
import { publicGuard, type SlugCtx } from "@/lib/public-api";
import { createLead, trackEvent } from "@/lib/quotes";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, putFile, sniffImage } from "@/lib/storage";
import { verifyTurnstile } from "@/lib/turnstile";

const schema = z.object({
  quoteId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2, "Enter your name").max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email("Enter a valid email").max(200),
  notes: z.string().trim().max(2000).optional(),
  preferredWindow: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  smsConsent: z.boolean(),
  turnstileToken: z.string().max(4000).optional(),
  sessionId: z.string().max(100).optional(),
  channel: z.string().max(20).optional(),
  website: z.string().max(200).optional(), // honeypot: real people never fill this
});

const MAX_PHOTOS = 5;

export const POST = handler(async (req: Request, ctx: SlugCtx) => {
  const g = await publicGuard(req, ctx, "lead", { perIpPerMin: 5, perBusinessPerDay: 500 });
  if (!g.ok) return g.res;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "Invalid form");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? "{}"));
  } catch {
    return apiError(400, "Invalid form");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  if (d.website) return json({ ok: true }); // bot

  if (!toE164(d.phone)) return apiError(400, "Enter a valid US phone number");
  if (!(await verifyTurnstile(d.turnstileToken, g.ip))) return apiError(400, "Please complete the security check and try again.");

  // The quote must belong to this business and be recent.
  let quote: typeof quotes.$inferSelect | undefined;
  if (d.quoteId) {
    const db = await getDb();
    [quote] = await db.select().from(quotes).where(and(eq(quotes.id, d.quoteId), eq(quotes.businessId, g.business.id))).limit(1);
    if (!quote || Date.now() - quote.createdAt.getTime() > 48 * 3600_000) quote = undefined;
  }

  const files = form.getAll("photos").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
  if (files.length > MAX_PHOTOS) return apiError(400, `Up to ${MAX_PHOTOS} photos`);
  const photos: string[] = [];
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return apiError(400, "Each photo must be under 8 MB");
    const bytes = new Uint8Array(await f.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return apiError(400, "Photos must be JPG, PNG, WEBP or HEIC images");
    const path = `photos/${g.business.id}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
    await putFile(path, bytes, type);
    photos.push(path);
  }

  const { lead, jobIds } = await createLead({
    business: g.business,
    quoteId: quote?.id ?? null,
    name: d.name,
    phone: toE164(d.phone)!,
    email: d.email,
    notes: d.notes,
    preferredWindow: d.preferredWindow,
    photos,
    address: quote?.address ?? d.address ?? null,
    total: quote?.total ?? null,
    smsConsent: d.smsConsent,
    consentText: smsConsentText(g.business.name),
    ip: g.ip,
  });
  await trackEvent(g.business.id, "lead", d.sessionId, d.channel);

  // Send alerts right after responding, so the owner hears within seconds.
  // The cron worker retries anything that fails.
  after(() => runDueJobs({ ids: jobIds }).catch(() => {}));
  return json({ ok: true, leadId: lead.id });
});
