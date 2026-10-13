"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, requireUser, setActiveBusiness } from "@/lib/auth";
import { createBusinessForUser } from "@/lib/business";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { geocodeText, parseZips } from "@/lib/geocode";
import { toE164 } from "@/lib/messaging/sms";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(80),
  phone: z.string().trim().max(30).optional(),
  website: z.string().trim().max(200).optional(),
  alertEmail: z.string().trim().email("Enter a valid alert email"),
  alertPhone: z.string().trim().max(30).optional(),
  smsAlerts: z.boolean(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  serviceIds: z.array(z.string()).min(1, "Pick at least one service"),
  zips: z.string().max(5000).optional(),
  centerText: z.string().max(200).optional(),
  radiusMiles: z.number().min(0).max(200).optional(),
  timezone: z.string().max(60),
});

export type OnboardingInput = z.infer<typeof schema>;

export async function createBusinessAction(input: OnboardingInput): Promise<{ error: string } | never> {
  const user = await requireUser("/app/onboarding");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  if (d.alertPhone && !toE164(d.alertPhone)) return { error: "Enter a valid mobile number for alerts" };
  const validIds = new Set(SERVICE_TEMPLATES.map((s) => s.id));

  const center = d.centerText && d.radiusMiles ? await geocodeText(d.centerText) : null;
  if (d.centerText && d.radiusMiles && !center) return { error: "We couldn't find that city or address for your service area" };

  const b = await createBusinessForUser(user.id, {
    name: d.name,
    phone: d.phone || null,
    website: d.website || null,
    alertEmail: d.alertEmail,
    alertPhone: d.alertPhone ? toE164(d.alertPhone) : null,
    brandColor: d.brandColor,
    serviceIds: d.serviceIds.filter((id) => validIds.has(id)),
    serviceArea: {
      zips: parseZips(d.zips ?? ""),
      ...(center ? { center: { lat: center.lat, lng: center.lng, label: center.label }, radiusMiles: d.radiusMiles } : {}),
    },
    timezone: d.timezone,
  });
  const db = await getDb();
  await db
    .update(businesses)
    .set({ smsAlertsEnabled: !!(d.smsAlerts && d.alertPhone), onboardingComplete: true })
    .where(eq(businesses.id, b.id));
  await setActiveBusiness(b.id);
  await audit(user.id, b.id, "business.created");
  redirect("/app/pricing?welcome=1");
}
