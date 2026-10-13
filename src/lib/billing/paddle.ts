import "server-only";
import { eq } from "drizzle-orm";
import { hmacSha256Hex, safeEqual } from "../crypto";
import { getDb } from "../db";
import { businesses, paddleEvents, subscriptions, type BusinessStatus, type Plan } from "../db/schema";
import { env } from "../env";

/**
 * Paddle Billing (merchant of record). Checkout runs in the browser with
 * Paddle.js; subscription state arrives by signed webhooks and is the only
 * thing that changes a business's plan or status.
 */

export function paddleLive(): boolean {
  return !!(env.paddleApiKey && env.paddleClientToken && env.paddleWebhookSecret);
}

function apiBase(): string {
  return env.paddleEnv === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

export function planForPrice(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  const p = env.paddlePrices;
  if (priceId === p.starter_monthly || priceId === p.starter_annual) return "starter";
  if (priceId === p.pro_monthly || priceId === p.pro_annual) return "pro";
  if (priceId === p.founding) return "founding";
  return null;
}

/** Verifies the Paddle-Signature header: "ts=<unix>;h1=<hex hmac of `${ts}:${body}`>". */
export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(";").map((kv) => kv.split("=") as [string, string]));
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSec) return false;
  return safeEqual(h1, hmacSha256Hex(secret, `${ts}:${rawBody}`));
}

export async function createPortalUrl(customerId: string, subscriptionId?: string | null): Promise<string | null> {
  if (!env.paddleApiKey) return null;
  const res = await fetch(`${apiBase()}/customers/${customerId}/portal-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.paddleApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(subscriptionId ? { subscription_ids: [subscriptionId] } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } };
  return json.data?.urls?.general?.overview ?? null;
}

type PaddleSubscription = {
  id: string;
  status: "active" | "trialing" | "past_due" | "paused" | "canceled";
  customer_id: string;
  custom_data?: { businessId?: string } | null;
  items?: { price?: { id?: string } }[];
  current_billing_period?: { ends_at?: string } | null;
  next_billed_at?: string | null;
  canceled_at?: string | null;
  started_at?: string | null;
  first_billed_at?: string | null;
};

export type PaddleEvent = { event_id: string; event_type: string; occurred_at?: string; data: unknown };

function statusFor(s: PaddleSubscription["status"]): BusinessStatus {
  return s === "active" ? "active" : s === "trialing" ? "trial" : s === "past_due" ? "past_due" : s === "paused" ? "paused" : "canceled";
}

/** Applies a verified webhook event. Idempotent: duplicate deliveries are ignored by event_id. */
export async function applyPaddleEvent(evt: PaddleEvent): Promise<"processed" | "duplicate" | "ignored"> {
  const db = await getDb();
  const inserted = await db
    .insert(paddleEvents)
    .values({ eventId: evt.event_id, type: evt.event_type, payload: evt as unknown as object })
    .onConflictDoNothing()
    .returning({ id: paddleEvents.eventId });
  if (!inserted.length) return "duplicate";
  if (!evt.event_type.startsWith("subscription.")) return "ignored";

  const s = evt.data as PaddleSubscription;
  let businessId = s.custom_data?.businessId;
  if (!businessId) {
    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.paddleSubscriptionId, s.id)).limit(1);
    businessId = existing?.businessId;
  }
  if (!businessId) return "ignored";
  const [biz] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return "ignored";

  const priceId = s.items?.[0]?.price?.id ?? null;
  const plan = planForPrice(priceId);
  const [prev] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1);
  // Ignore events older than what we already applied (Paddle may deliver out of order).
  if (prev && evt.occurred_at && prev.updatedAt > new Date(evt.occurred_at)) return "ignored";

  const row = {
    businessId,
    paddleCustomerId: s.customer_id,
    paddleSubscriptionId: s.id,
    priceId,
    plan,
    status: s.status,
    trialEndsAt: s.status === "trialing" && s.next_billed_at ? new Date(s.next_billed_at) : null,
    currentPeriodEnd: s.current_billing_period?.ends_at ? new Date(s.current_billing_period.ends_at) : null,
    canceledAt: s.canceled_at ? new Date(s.canceled_at) : null,
    pastDueSince: s.status === "past_due" ? (prev?.pastDueSince ?? new Date()) : null,
    updatedAt: evt.occurred_at ? new Date(evt.occurred_at) : new Date(),
  };
  await db.insert(subscriptions).values(row).onConflictDoUpdate({ target: subscriptions.businessId, set: row });
  await db
    .update(businesses)
    .set({ status: statusFor(s.status), ...(plan ? { plan, poweredByHidden: plan !== "starter" ? undefined : false } : {}), updatedAt: new Date() })
    .where(eq(businesses.id, businessId));
  return "processed";
}
