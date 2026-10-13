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

export const TRIAL_DAYS = 14;
/** Days a past-due or expired account keeps full features before switching to "requests only". */
export const GRACE_DAYS = 7;

export type WidgetMode = "full" | "requests_only";

/**
 * Decides whether the widget shows prices. Accounts that stopped paying are
 * never broken: the widget keeps collecting quote requests, just without prices.
 */
export function widgetMode(
  b: { status: string; createdAt: Date },
  sub: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; pastDueSince: Date | null } | null,
  now = new Date(),
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
  // No subscription yet: free trial counted from signup, then grace.
  const trialEnd = b.createdAt.getTime() + TRIAL_DAYS * 86400_000;
  return now.getTime() < trialEnd + graceMs ? "full" : "requests_only";
}

export function canUseIntegration(plan: Plan, type: "webhook" | "ghl" | "jobber"): boolean {
  return type === "webhook" || PLANS[plan].crm === "all";
}
