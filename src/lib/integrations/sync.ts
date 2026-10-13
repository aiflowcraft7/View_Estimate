import "server-only";
import { and, eq } from "drizzle-orm";
import { canUseIntegration } from "../billing/plans";
import { decryptJson, encryptJson } from "../crypto";
import { getDb } from "../db";
import { businesses, integrations, leads } from "../db/schema";
import { enqueue, PermanentJobError, registerJob } from "../jobs/queue";
import { loadLeadContext } from "../lead-context";
import { flattenForGhl } from "./payload";
import { pushLeadToJobber, type JobberTokens } from "./jobber";
import { postSignedJson } from "./webhook";

export type WebhookCredentials = { url: string; secret: string };
export type GhlCredentials = { url: string };

/** Queues one CRM sync job per active integration the plan allows. Returns job ids. */
export async function enqueueCrmSync(businessId: string, leadId: string): Promise<string[]> {
  const db = await getDb();
  const [b] = await db.select({ plan: businesses.plan }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!b) return [];
  const rows = await db.select().from(integrations).where(and(eq(integrations.businessId, businessId), eq(integrations.status, "active")));
  const usable = rows.filter((r) => canUseIntegration(b.plan, r.type));
  if (!usable.length) return [];
  await db.update(leads).set({ crmSyncStatus: "pending" }).where(eq(leads.id, leadId));
  const ids: string[] = [];
  for (const i of usable) ids.push(await enqueue("crm.sync", { integrationId: i.id, leadId }, { businessId, maxAttempts: 8 }));
  return ids;
}

async function markLead(leadId: string, status: "synced" | "failed") {
  const db = await getDb();
  await db.update(leads).set({ crmSyncStatus: status, updatedAt: new Date() }).where(eq(leads.id, leadId));
}

export function registerCrmJobs() {
  registerJob("crm.sync", async (payload, ctx) => {
    const db = await getDb();
    const integrationId = String(payload.integrationId);
    const leadId = String(payload.leadId);
    const [integ] = await db.select().from(integrations).where(eq(integrations.id, integrationId)).limit(1);
    if (!integ || integ.status === "disconnected") return { skipped: "integration removed" };
    const { payload: lead } = await loadLeadContext(leadId);

    try {
      let result: unknown;
      if (integ.type === "webhook") {
        const creds = decryptJson<WebhookCredentials>(integ.credentials);
        if (!creds?.url) throw new PermanentJobError("Webhook URL missing");
        result = await postSignedJson(creds.url, creds.secret, lead, `${ctx.id}`);
      } else if (integ.type === "ghl") {
        const creds = decryptJson<GhlCredentials>(integ.credentials);
        if (!creds?.url) throw new PermanentJobError("GoHighLevel webhook URL missing");
        result = await postSignedJson(creds.url, null, flattenForGhl(lead), `${ctx.id}`);
      } else if (integ.type === "jobber") {
        const tokens = decryptJson<JobberTokens>(integ.credentials);
        if (!tokens) throw new PermanentJobError("Jobber is not connected");
        result = await pushLeadToJobber(tokens, lead, async (t) => {
          await db.update(integrations).set({ credentials: encryptJson(t) }).where(eq(integrations.id, integ.id));
        });
      } else {
        throw new PermanentJobError(`Unknown integration ${integ.type}`);
      }
      await db.update(integrations).set({ lastSyncAt: new Date(), lastError: null, status: "active" }).where(eq(integrations.id, integ.id));
      await markLead(leadId, "synced");
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.update(integrations).set({ lastError: msg.slice(0, 500) }).where(eq(integrations.id, integ.id));
      if (e instanceof PermanentJobError || ctx.isLastAttempt) await markLead(leadId, "failed");
      throw e;
    }
  });
}
