"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { audit, requireBusiness } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { pricingConfigSchema } from "@/lib/pricing/schema";
import type { PricingConfig } from "@/lib/pricing/types";

export async function savePricing(config: PricingConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireBusiness();
  const parsed = pricingConfigSchema.safeParse(config);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `${i.path.join(" › ") || "Pricing"}: ${i.message}` };
  }
  const db = await getDb();
  await db.update(businesses).set({ pricing: parsed.data as PricingConfig, updatedAt: new Date() }).where(eq(businesses.id, ctx.business.id));
  await audit(ctx.user.id, ctx.business.id, "pricing.save", { actingAsAdmin: ctx.actingAsAdmin, services: parsed.data.services.length });
  revalidatePath("/app/pricing");
  return { ok: true };
}
