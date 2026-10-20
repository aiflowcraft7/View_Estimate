import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { businesses } from "./db/schema";
import { DEFAULT_PRICING, SERVICE_TEMPLATES } from "./pricing/templates";
import type { PricingConfig, ServiceConfig } from "./pricing/types";

/** Adds on-site rules introduced after a demo row was first saved, without touching rates. */
function backfillOnsiteRules(pricing: PricingConfig): PricingConfig | null {
  let changed = false;
  const services = pricing.services.map((service) => {
    const next = mergeOnsite(service);
    if (next !== service) changed = true;
    return next;
  });
  return changed ? { ...pricing, services } : null;
}

function mergeOnsite(service: ServiceConfig): ServiceConfig {
  const extra = SERVICE_TEMPLATES.find((t) => t.id === service.id)?.confirmOnsite;
  if (!extra) return service;
  const current = service.confirmOnsite ?? {};
  const patch: NonNullable<ServiceConfig["confirmOnsite"]> = {};
  if (extra.sidingOnsite?.length && current.sidingOnsite === undefined) patch.sidingOnsite = extra.sidingOnsite;
  if (extra.onStaining === true && current.onStaining === undefined) patch.onStaining = true;
  if (extra.onNeglectedGutters === true && current.onNeglectedGutters === undefined) patch.onNeglectedGutters = true;
  if (Object.keys(patch).length === 0) return service;
  return { ...service, confirmOnsite: { ...current, ...patch } };
}

export const DEMO_SLUG = "demo";

/** The public demo business shown on the marketing site (/demo). Created on first use. */
export async function ensureDemoBusiness() {
  const db = await getDb();
  const [existing] = await db.select().from(businesses).where(eq(businesses.slug, DEMO_SLUG)).limit(1);
  if (existing) {
    const pricing = backfillOnsiteRules(existing.pricing);
    if (!pricing) return existing;
    const [updated] = await db.update(businesses).set({ pricing, updatedAt: new Date() }).where(eq(businesses.id, existing.id)).returning();
    return updated ?? existing;
  }
  const [b] = await db
    .insert(businesses)
    .values({
      slug: DEMO_SLUG,
      name: "Sunshine Soft Wash (demo)",
      headline: "Instant prices for house, roof and driveway cleaning",
      brandColor: "#0e7490",
      phone: "(813) 555-0142",
      pricing: DEFAULT_PRICING,
      status: "demo",
      createdByAdmin: true,
      onboardingComplete: true,
      claimedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  return b ?? (await db.select().from(businesses).where(eq(businesses.slug, DEMO_SLUG)).limit(1))[0];
}
