"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, requireBusiness } from "@/lib/auth";
import { getSubscription } from "@/lib/business";
import { createPortalUrl, paddleLive } from "@/lib/billing/paddle";
import { getDb } from "@/lib/db";
import { businesses, subscriptions } from "@/lib/db/schema";
import { env } from "@/lib/env";

export async function openPortal() {
  const ctx = await requireBusiness();
  const sub = await getSubscription(ctx.business.id);
  if (!sub?.paddleCustomerId) redirect("/app/billing");
  const url = await createPortalUrl(sub.paddleCustomerId, sub.paddleSubscriptionId);
  redirect(url ?? "/app/billing?portal=error");
}

/** Local development only: activates a plan without Paddle so the whole app can be tested. */
export async function simulateSubscribe(form: FormData) {
  if (paddleLive() || env.isProduction) throw new Error("Not available");
  const ctx = await requireBusiness();
  const plan = z.enum(["starter", "pro", "founding"]).parse(form.get("plan"));
  const db = await getDb();
  const row = { businessId: ctx.business.id, plan, status: "active", priceId: `sim_${plan}`, currentPeriodEnd: new Date(Date.now() + 30 * 86400_000), updatedAt: new Date() };
  await db.insert(subscriptions).values(row).onConflictDoUpdate({ target: subscriptions.businessId, set: row });
  await db.update(businesses).set({ plan, status: "active" }).where(eq(businesses.id, ctx.business.id));
  await audit(ctx.user.id, ctx.business.id, "billing.simulated_subscribe", { plan });
  redirect("/app/billing?simulated=1");
}

export async function setBranding(form: FormData) {
  const ctx = await requireBusiness();
  const hide = form.get("hide") === "on";
  if (hide && ctx.business.plan === "starter") return;
  const db = await getDb();
  await db.update(businesses).set({ poweredByHidden: hide }).where(eq(businesses.id, ctx.business.id));
  redirect("/app/billing");
}
