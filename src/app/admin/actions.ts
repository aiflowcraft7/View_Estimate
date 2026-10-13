"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, requireAdmin, startActingAs } from "@/lib/auth";
import { createDemoBusiness, newClaimLink } from "@/lib/business";
import { getDb } from "@/lib/db";
import { businesses, jobs } from "@/lib/db/schema";
import { geocodeText, parseZips } from "@/lib/geocode";
import { retryJob } from "@/lib/jobs/queue";
import { runDueJobs } from "@/lib/jobs/queue";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";
import { IMAGE_TYPES, fileUrl, putFile, sniffImage } from "@/lib/storage";

export type DemoState = { error?: string; demoUrl?: string; claimUrl?: string; id?: string };

const demo = z.object({
  name: z.string().trim().min(2).max(80),
  website: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  alertEmail: z.string().trim().email().optional().or(z.literal("")),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  priceFactor: z.coerce.number().min(0.3).max(3),
  zips: z.string().max(5000).optional(),
  centerText: z.string().max(200).optional(),
  radiusMiles: z.coerce.number().min(0).max(200).optional(),
  headline: z.string().max(120).optional(),
});

export async function createDemo(_: DemoState, form: FormData): Promise<DemoState> {
  const admin = await requireAdmin();
  const parsed = demo.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const d = parsed.data;
  const serviceIds = form.getAll("services").map(String).filter((id) => SERVICE_TEMPLATES.some((s) => s.id === id));
  if (!serviceIds.length) return { error: "Pick at least one service" };

  // Scale template prices to roughly match the company's published prices.
  const services = SERVICE_TEMPLATES.filter((s) => serviceIds.includes(s.id)).map((s) => ({
    ...structuredClone(s),
    rate: Math.round(s.rate * d.priceFactor * 1000) / 1000,
    minPrice: s.minPrice ? Math.round(s.minPrice * d.priceFactor) : undefined,
  }));
  const center = d.centerText && d.radiusMiles ? await geocodeText(d.centerText) : null;

  let logoUrl: string | null = d.logoUrl || null;
  const file = form.get("logo");
  if (file && typeof file === "object" && "size" in file && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes, true);
    if (!type || file.size > 2 * 1024 * 1024) return { error: "Logo must be an image under 2 MB" };
    const path = `logos/demo-${Date.now()}.${IMAGE_TYPES[type]}`;
    await putFile(path, bytes, type);
    logoUrl = fileUrl(path);
  }

  const { DEFAULT_PRICING } = await import("@/lib/pricing/templates");
  const { business, claimUrl } = await createDemoBusiness({
    name: d.name,
    website: d.website || null,
    phone: d.phone || null,
    alertEmail: d.alertEmail || null,
    brandColor: d.brandColor,
    logoUrl,
    pricing: { ...DEFAULT_PRICING, services },
    serviceArea: { zips: parseZips(d.zips ?? ""), ...(center ? { center: { lat: center.lat, lng: center.lng, label: center.label }, radiusMiles: d.radiusMiles } : {}) },
  });
  if (d.headline) {
    const db = await getDb();
    await db.update(businesses).set({ headline: d.headline }).where(eq(businesses.id, business.id));
  }
  await audit(admin.id, business.id, "admin.demo.create");
  revalidatePath("/admin");
  const { env } = await import("@/lib/env");
  return { demoUrl: `${env.appUrl}/q/${business.slug}`, claimUrl, id: business.id };
}

export async function actAs(form: FormData) {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  await startActingAs(admin, id);
  redirect("/app");
}

export async function regenerateClaim(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const url = await newClaimLink(id);
  await audit(admin.id, id, "admin.claim_link");
  redirect(`/admin/b/${id}?claim=${encodeURIComponent(url)}`);
}

export async function copyPricing(form: FormData) {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const from = z.string().uuid().parse(form.get("from"));
  const db = await getDb();
  const [src] = await db.select({ pricing: businesses.pricing }).from(businesses).where(eq(businesses.id, from));
  if (!src) return;
  await db.update(businesses).set({ pricing: src.pricing, updatedAt: new Date() }).where(eq(businesses.id, id));
  await audit(admin.id, id, "admin.pricing.copy", { from });
  revalidatePath(`/admin/b/${id}`);
}

export async function updateBusinessAdmin(form: FormData) {
  const admin = await requireAdmin();
  const d = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["demo", "trial", "active", "past_due", "paused", "canceled"]),
      plan: z.enum(["starter", "pro", "founding"]),
      monthlyQuoteCap: z.coerce.number().int().min(0).max(1000000),
    })
    .parse(Object.fromEntries(form));
  const db = await getDb();
  await db.update(businesses).set({ status: d.status, plan: d.plan, monthlyQuoteCap: d.monthlyQuoteCap, updatedAt: new Date() }).where(eq(businesses.id, d.id));
  await audit(admin.id, d.id, "admin.business.update", { status: d.status, plan: d.plan, cap: d.monthlyQuoteCap });
  revalidatePath(`/admin/b/${d.id}`);
}

export async function deleteBusiness(form: FormData) {
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  if (form.get("confirm") !== "DELETE") redirect(`/admin/b/${id}?error=confirm`);
  const db = await getDb();
  await db.delete(businesses).where(and(eq(businesses.id, id), ne(businesses.slug, "demo")));
  await audit(admin.id, id, "admin.business.delete");
  redirect("/admin");
}

export async function retryJobAction(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  await retryJob(id);
  await runDueJobs({ ids: [id] });
  revalidatePath("/admin/jobs");
}

export async function runQueueNow() {
  await requireAdmin();
  await runDueJobs({ limit: 50 });
  revalidatePath("/admin/jobs");
}

export async function dropJob(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const db = await getDb();
  await db.update(jobs).set({ status: "done", lastError: "Dismissed by admin" }).where(eq(jobs.id, id));
  revalidatePath("/admin/jobs");
}
