import type { Plan } from "../db/schema";

export type PlanDef = {
  id: Plan;
  name: string;
  monthly: number;
  annual: number;
  smsAlertsPerMonth: number;
  crm: "webhook" | "all";
  removeBranding: boolean;
  features: string[];
};

export const PLANS: Record<Plan, PlanDef> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthly: 49,
    annual: 490,
    smsAlertsPerMonth: 100,
    crm: "webhook",
    removeBranding: false,
    features: ["Quote widget, hosted page and QR code", "Unlimited leads", "Email alerts", "100 SMS alerts a month", "Webhook and Zapier", "Done-for-you setup"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly: 79,
    annual: 790,
    smsAlertsPerMonth: 500,
    crm: "all",
    removeBranding: true,
    features: ["Everything in Starter", "500 SMS alerts a month", "Jobber and GoHighLevel sync", "Remove \"Powered by\"", "Quarterly price review"],
  },
  founding: {
    id: "founding",
    name: "Founding member",
    monthly: 39,
    annual: 390,
    smsAlertsPerMonth: 500,
    crm: "all",
    removeBranding: true,
    features: ["Everything in Pro", "$39 a month for life"],
  },
};

/** @deprecated Public offer is first 3 leads / 45 days. Kept so older imports still compile. */
export const TRIAL_DAYS = 14;
/** Included leads before a plan is required. */
export const FREE_LEADS = 3;
/** Days after claim that prices stay on if fewer than FREE_LEADS have arrived. */
export const FREE_WINDOW_DAYS = 45;
/** Days a past-due, canceled, or just-ended free start keeps prices before "requests only". */
export const GRACE_DAYS = 7;

export type WidgetMode = "full" | "requests_only";

export type FreeStart = {
  /** Delivered leads so far. Defaults to 0 when omitted. */
  leadCount?: number;
  /** When the lead that used up the free allotment was created. */
  thirdLeadAt?: Date | null;
};

/**
 * Decides whether the widget shows prices. Accounts that stopped paying are
 * never broken: the widget keeps collecting quote requests, just without prices.
 * With no subscription, prices stay on until the 3rd lead or 45 days, then grace.
 */
export function widgetMode(
  b: { status: string; createdAt: Date },
  sub: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; pastDueSince: Date | null } | null,
  now = new Date(),
  free?: FreeStart,
): WidgetMode {
  const graceMs = GRACE_DAYS * 86400_000;
  if (b.status === "demo") return "full";
  if (b.status === "paused") return "requests_only";
  if (sub) {
    if (sub.status === "active" || sub.status === "trialing") return "full";
    if (sub.status === "past_due") {
      const since = sub.pastDueSince ?? now;
      return now.getTime() - since.getTime() < graceMs ? "full" : "requests_only";
    }
    if (sub.status === "canceled" || sub.status === "paused") {
      const end = sub.currentPeriodEnd ?? now;
      return now.getTime() < end.getTime() + graceMs ? "full" : "requests_only";
    }
    return "full";
  }
  const leadCount = free?.leadCount ?? 0;
  const windowEnd = b.createdAt.getTime() + FREE_WINDOW_DAYS * 86400_000;
  const freeEnd = leadCount >= FREE_LEADS ? Math.min(windowEnd, (free?.thirdLeadAt ?? now).getTime()) : windowEnd;
  return now.getTime() < freeEnd + graceMs ? "full" : "requests_only";
}

export function canUseIntegration(plan: Plan, type: "webhook" | "ghl" | "jobber"): boolean {
  return type === "webhook" || PLANS[plan].crm === "all";
}
