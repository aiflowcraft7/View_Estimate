"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireBusiness } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { geocodeText, parseZips } from "@/lib/geocode";
import { toE164 } from "@/lib/messaging/sms";
import { MAX_UPLOAD_BYTES, IMAGE_TYPES, fileUrl, putFile, sniffImage } from "@/lib/storage";

export type SettingsState = { ok?: string; error?: string };

const profile = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30),
  website: z.string().trim().max(200),
  headline: z.string().trim().max(120),
  timezone: z.string().max(60),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color"),
});

export async function saveProfile(_: SettingsState, form: FormData): Promise<SettingsState> {
  const ctx = await requireBusiness();
  const d = profile.safeParse(Object.fromEntries(form));
  if (!d.success) return { error: d.error.issues[0].message };
  const patch: Partial<typeof businesses.$inferInsert> = { ...d.data, phone: d.data.phone || null, website: d.data.website || null, headline: d.data.headline || null, updatedAt: new Date() };

  const logo = form.get("logo");
  if (logo && typeof logo === "object" && "size" in logo && logo.size > 0) {
    if (logo.size > MAX_UPLOAD_BYTES / 4) return { error: "Logo must be under 2 MB" };
    const bytes = new Uint8Array(await logo.arrayBuffer());
    const type = sniffImage(bytes, true);
    if (!type || type === "image/heic") return { error: "Logo must be PNG, JPG, WEBP, GIF or SVG" };
    const path = `logos/${ctx.business.id}/${Date.now()}.${IMAGE_TYPES[type]}`;
    await putFile(path, bytes, type);
    patch.logoUrl = fileUrl(path);
  }
  if (form.get("removeLogo") === "on") patch.logoUrl = null;

  const db = await getDb();
  await db.update(businesses).set(patch).where(eq(businesses.id, ctx.business.id));
  await audit(ctx.user.id, ctx.business.id, "settings.profile");
  revalidatePath("/app", "layout");
  return { ok: "Saved" };
}

const alerts = z.object({ alertEmail: z.string().trim().email("Enter a valid alert email"), alertPhone: z.string().trim().max(30), smsAlertsEnabled: z.string().optional() });

export async function saveAlerts(_: SettingsState, form: FormData): Promise<SettingsState> {
  const ctx = await requireBusiness();
  const d = alerts.safeParse(Object.fromEntries(form));
  if (!d.success) return { error: d.error.issues[0].message };
  const phone = d.data.alertPhone ? toE164(d.data.alertPhone) : null;
  if (d.data.alertPhone && !phone) return { error: "Enter a valid US mobile number" };
  const db = await getDb();
  await db
    .update(businesses)
    .set({ alertEmail: d.data.alertEmail, alertPhone: phone, smsAlertsEnabled: !!phone && d.data.smsAlertsEnabled === "on", updatedAt: new Date() })
    .where(eq(businesses.id, ctx.business.id));
  await audit(ctx.user.id, ctx.business.id, "settings.alerts");
  revalidatePath("/app/settings");
  return { ok: "Saved" };
}

export async function saveArea(_: SettingsState, form: FormData): Promise<SettingsState> {
  const ctx = await requireBusiness();
  const zips = parseZips(String(form.get("zips") ?? ""));
  const centerText = String(form.get("centerText") ?? "").trim().slice(0, 200);
  const radius = Math.max(0, Math.min(200, Number(form.get("radiusMiles")) || 0));
  let center = ctx.business.serviceArea.center;
  if (!centerText || !radius) center = undefined;
  else if (centerText !== center?.label) {
    const g = await geocodeText(centerText);
    if (!g) return { error: "We couldn't find that city or address" };
    center = { lat: g.lat, lng: g.lng, label: g.label };
  }
  const db = await getDb();
  await db
    .update(businesses)
    .set({ serviceArea: { zips, ...(center ? { center, radiusMiles: radius } : {}) }, updatedAt: new Date() })
    .where(eq(businesses.id, ctx.business.id));
  await audit(ctx.user.id, ctx.business.id, "settings.area");
  revalidatePath("/app/settings");
  return { ok: "Saved" };
}
