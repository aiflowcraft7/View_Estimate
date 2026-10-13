import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { PLANS } from "../billing/plans";
import { getDb } from "../db";
import { notifications } from "../db/schema";
import { registerCrmJobs } from "../integrations/sync";
import { loadLeadContext } from "../lead-context";
import { sendEmail } from "../messaging/email";
import { sendSms } from "../messaging/sms";
import { homeownerConfirmationEmail, leadAlertEmail, leadAlertSms, type LeadAlertData } from "../messaging/templates";
import { addUsage } from "../usage";
import { PermanentJobError, registerJob } from "./queue";

let registered = false;

async function smsSentThisMonth(businessId: string): Promise<number> {
  const db = await getDb();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [r] = await db
    .select({ n: sql<number>`coalesce(sum(${notifications.segments}), 0)::int` })
    .from(notifications)
    .where(and(eq(notifications.businessId, businessId), eq(notifications.channel, "sms"), eq(notifications.status, "sent"), gte(notifications.createdAt, start)));
  return r?.n ?? 0;
}

async function record(n: typeof notifications.$inferInsert) {
  const db = await getDb();
  await db.insert(notifications).values(n);
}

export function ensureHandlers() {
  if (registered) return;
  registered = true;

  /** Owner alert: email and (if enabled and within plan limit) SMS. Retries only the channel that failed. */
  registerJob("lead.alert", async (payload, ctx) => {
    const done = new Set((payload.done as string[] | undefined) ?? []);
    const { lead, business, quote, leadUrl } = await loadLeadContext(String(payload.leadId));
    const data: LeadAlertData = {
      businessName: business.name,
      brandColor: business.brandColor,
      leadUrl,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      mapUrl: quote?.lat != null ? `https://www.google.com/maps/search/?api=1&query=${quote.lat},${quote.lng}` : lead.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}` : null,
      preferredWindow: lead.preferredWindow,
      notes: lead.notes,
      photoCount: lead.photos.length,
      sizeSource: quote?.property.source ?? "none",
      sizeSummary: quote
        ? [quote.property.livingSqft ? `${quote.property.livingSqft.toLocaleString()} sq ft` : quote.property.footprintSqft ? `${quote.property.footprintSqft.toLocaleString()} sq ft footprint` : null, `${quote.property.stories} ${quote.property.stories === 1 ? "story" : "stories"}`]
            .filter(Boolean)
            .join(", ")
        : "not provided",
      result: quote?.result ?? { lines: [], subtotal: 0, discount: null, orderMinimumApplied: false, total: lead.total ?? 0, displayMode: "exact", range: null, needsOnsiteConfirmation: true, bundleNudge: null, errors: [] },
    };

    const errors: string[] = [];
    const to = business.alertEmail;
    if (to && !done.has("email")) {
      const r = await sendEmail(leadAlertEmail(to, data));
      await record({ businessId: business.id, leadId: lead.id, channel: "email", kind: "lead_alert", to, status: r.ok ? "sent" : "failed", providerId: r.ok ? r.id : null, error: r.ok ? null : r.error });
      if (r.ok) {
        done.add("email");
        await addUsage("email", business.id);
      } else if (r.retryable) errors.push(r.error);
    }

    if (business.smsAlertsEnabled && business.alertPhone && !done.has("sms")) {
      const limit = PLANS[business.plan].smsAlertsPerMonth;
      if ((await smsSentThisMonth(business.id)) >= limit) {
        await record({ businessId: business.id, leadId: lead.id, channel: "sms", kind: "lead_alert", to: business.alertPhone, status: "skipped", error: `Monthly SMS limit (${limit}) reached` });
        done.add("sms");
      } else {
        const r = await sendSms(business.alertPhone, leadAlertSms(data));
        await record({ businessId: business.id, leadId: lead.id, channel: "sms", kind: "lead_alert", to: business.alertPhone, status: r.ok ? "sent" : "failed", providerId: r.ok ? r.id : null, error: r.ok ? null : r.error, segments: r.ok ? r.segments : null });
        if (r.ok) {
          done.add("sms");
          await addUsage("sms_segments", business.id, r.segments ?? 1);
        } else if (r.retryable) errors.push(r.error);
      }
    }

    if (errors.length) {
      payload.done = [...done];
      throw new Error(errors.join("; "));
    }
    if (!to && !business.alertPhone) throw new PermanentJobError("Business has no alert email or phone");
    return { sent: [...done] };
  });

  registerJob("lead.confirmation", async (payload) => {
    const { lead, business, quote } = await loadLeadContext(String(payload.leadId));
    if (!quote) return { skipped: "no quote" };
    const r = await sendEmail({
      ...homeownerConfirmationEmail(lead.email, { businessName: business.name, brandColor: business.brandColor, businessPhone: business.phone, name: lead.name.split(" ")[0], address: lead.address, result: quote.result }),
      replyTo: business.alertEmail ?? undefined,
    });
    await record({ businessId: business.id, leadId: lead.id, channel: "email", kind: "homeowner_confirmation", to: lead.email, status: r.ok ? "sent" : "failed", providerId: r.ok ? r.id : null, error: r.ok ? null : r.error });
    if (!r.ok) {
      if (r.retryable) throw new Error(r.error);
      throw new PermanentJobError(r.error);
    }
    return { id: r.id };
  });

  registerCrmJobs();
}
