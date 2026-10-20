"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getBuildClaimToken, getEditableUnclaimed } from "@/lib/build/claim-cookie";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/email";
import { scaleService } from "@/lib/pricing/calibrate";
import { SERVICE_TEMPLATES, templateFor } from "@/lib/pricing/templates";
import type { PricingConfig } from "@/lib/pricing/types";

async function requireEdit(slug: string) {
  const ctx = await getEditableUnclaimed(slug);
  if (!ctx) throw new Error("You can only edit this page from the browser that built it");
  return ctx;
}

export async function activateAction(slug: string, email: string): Promise<{ error?: string } | never> {
  const parsed = z.string().trim().email("Enter a valid email").safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  const token = await getBuildClaimToken();
  if (!token) return { error: "Your edit session expired. Build again from /build." };
  const ctx = await getEditableUnclaimed(slug);
  if (!ctx) return { error: "Your edit session expired. Build again from /build." };

  const db = await getDb();
  await db.update(businesses).set({ alertEmail: parsed.data, updatedAt: new Date() }).where(eq(businesses.id, ctx.business.id));

  const claimUrl = `${env.appUrl}/claim/${token}`;
  await sendEmail({
    to: parsed.data,
    subject: `Claim your ${env.appName} quote page`,
    text: `Your quote page for ${ctx.business.name} is ready.\n\nClaim it here (your first 3 leads are free):\n${claimUrl}\n\nHosted page: ${env.appUrl}/q/${ctx.business.slug}`,
    html: `<p>Your quote page for <strong>${ctx.business.name}</strong> is ready.</p><p><a href="${claimUrl}">Claim it</a> to create your free login. Your first 3 leads are free.</p><p>Hosted page: <a href="${env.appUrl}/q/${ctx.business.slug}">${env.appUrl}/q/${ctx.business.slug}</a></p>`,
  });

  redirect(`/claim/${token}`);
}

export async function updateBrandAction(slug: string, input: { name: string; brandColor: string }): Promise<{ error?: string }> {
  try {
    const ctx = await requireEdit(slug);
    const name = input.name.trim();
    if (name.length < 2) return { error: "Enter your business name" };
    if (!/^#[0-9a-fA-F]{6}$/.test(input.brandColor)) return { error: "Pick a valid color" };
    const db = await getDb();
    await db
      .update(businesses)
      .set({ name, brandColor: input.brandColor, updatedAt: new Date() })
      .where(eq(businesses.id, ctx.business.id));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save" };
  }
}

export async function updateServicesAction(slug: string, serviceIds: string[]): Promise<{ error?: string }> {
  try {
    const ctx = await requireEdit(slug);
    const valid = new Set(SERVICE_TEMPLATES.map((s) => s.id));
    const ids = serviceIds.filter((id) => valid.has(id));
    if (!ids.length) return { error: "Pick at least one service" };

    const prev = ctx.business.pricing as PricingConfig;
    const next = templateFor(ids);
    // Keep calibrated rates when the service id already existed
    next.services = next.services.map((s) => {
      const old = prev.services.find((x) => x.id === s.id);
      return old ?? s;
    });
    next.rules = prev.rules ?? next.rules;

    const db = await getDb();
    await db.update(businesses).set({ pricing: next, updatedAt: new Date() }).where(eq(businesses.id, ctx.business.id));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save" };
  }
}

export async function updatePricingAction(
  slug: string,
  input: { targets: Record<string, number>; orderMinimum: number },
): Promise<{ error?: string }> {
  try {
    const ctx = await requireEdit(slug);
    const pricing = structuredClone(ctx.business.pricing) as PricingConfig;
    pricing.services = pricing.services.map((s) => {
      const target = input.targets[s.id];
      if (typeof target === "number" && target > 0) return scaleService(s, Math.round(target));
      return s;
    });
    const min = Math.max(0, Math.round(input.orderMinimum));
    pricing.rules = { ...pricing.rules, orderMinimum: min || undefined };

    const db = await getDb();
    await db.update(businesses).set({ pricing, updatedAt: new Date() }).where(eq(businesses.id, ctx.business.id));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save" };
  }
}
