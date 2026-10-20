import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, devOutbox, integrations, jobs, leads, notifications } from "@/lib/db/schema";
import { createLead, getPublicBusiness, publicConfig, saveQuote } from "@/lib/quotes";
import { runDueJobs, backoffMs } from "@/lib/jobs/queue";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { makeOwner } from "./helpers";

describe("quote -> lead -> alerts", () => {
  it("recalculates price server-side, stores the lead and sends alerts", async () => {
    const { business } = await makeOwner("Sunshine Soft Wash");
    const db = await getDb();
    await db.update(businesses).set({ smsAlertsEnabled: true }).where(eq(businesses.id, business.id));
    const pb = (await getPublicBusiness(business.slug))!;
    expect(pb.mode).toBe("full");
    const cfg = publicConfig(pb);
    expect(cfg).not.toHaveProperty("alertEmail");

    const q = await saveQuote({
      business: pb,
      property: { footprintSqft: 1500, roofSqft: 1900, perimeterFt: 170, stories: 2, source: "solar" },
      selections: [{ serviceId: "house_wash" }, { serviceId: "driveway", sizeOptionId: "two_car" }],
      channel: "widget",
      address: "1 Bay St, Tampa, FL 33602, USA",
    });
    expect(q.result.total).toBeGreaterThan(0);
    expect(q.result.discount?.bundleId).toBe("two_plus");

    const { lead, jobIds } = await createLead({
      business: pb,
      quoteId: q.id,
      name: "Jane Homeowner",
      phone: "813-555-0199",
      email: "Jane@Example.com",
      smsConsent: true,
      consentText: "I agree",
      ip: "1.2.3.4",
      address: "1 Bay St, Tampa, FL 33602, USA",
      total: q.result.total,
    });
    expect(lead.email).toBe("jane@example.com");
    expect(lead.consentIp).toBe("1.2.3.4");

    const r = await runDueJobs({ ids: jobIds });
    expect(r.failed).toBe(0);
    const sent = await db.select().from(notifications).where(eq(notifications.leadId, lead.id));
    expect(sent.map((s) => `${s.channel}:${s.kind}:${s.status}`).sort()).toEqual(["email:homeowner_confirmation:sent", "email:lead_alert:sent", "sms:lead_alert:sent"]);
    const outbox = await db.select().from(devOutbox);
    expect(outbox.some((o) => o.subject?.startsWith("New lead: Jane Homeowner"))).toBe(true);
    expect(outbox.some((o) => o.channel === "sms" && o.to === "+18135550100")).toBe(true);
  });

  it("retries a failing webhook with backoff and keeps the lead pending", async () => {
    const { business } = await makeOwner("Hook Co");
    const db = await getDb();
    await db.insert(integrations).values({ businessId: business.id, type: "webhook", credentials: encryptJson({ url: "https://127.0.0.1/hook", secret: "s" }) });
    const pb = (await getPublicBusiness(business.slug))!;
    const { lead, jobIds } = await createLead({ business: pb, quoteId: null, name: "A B", phone: "8135550123", email: "a@b.co", smsConsent: false });
    await runDueJobs({ ids: jobIds });
    const crm = (await db.select().from(jobs).where(eq(jobs.type, "crm.sync"))).find((j) => j.payload.leadId === lead.id)!;
    // A private-network URL is a permanent failure (SSRF guard), so it goes straight to dead.
    expect(crm.status).toBe("dead");
    expect(crm.lastError).toMatch(/public internet/);
    const [l] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(l.crmSyncStatus).toBe("failed");
  });

  it("backoff grows and caps", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(30)).toBe(6 * 3600_000);
  });

  it("encrypts and decrypts credentials", () => {
    const c = encryptJson({ secretValue: 1 });
    expect(c).not.toContain("secretValue");
    expect(decryptJson<{ secretValue: number }>(c)).toEqual({ secretValue: 1 });
    expect(decryptJson("v1.bad.bad.bad")).toBeNull();
  });

  it("persists staining onsite confirmation without changing the total", async () => {
    const { business } = await makeOwner("Onsite Wash Co");
    const pb = (await getPublicBusiness(business.slug))!;
    const base = {
      footprintSqft: 1000,
      livingSqft: 2000,
      roofSqft: 1400,
      perimeterFt: 170,
      stories: 2,
      source: "solar" as const,
      siding: "vinyl" as const,
    };
    const clean = await saveQuote({
      business: pb,
      property: { ...base, staining: false },
      selections: [{ serviceId: "house_wash" }],
      channel: "widget",
      address: "2 Oak St, Tampa, FL",
    });
    const flagged = await saveQuote({
      business: pb,
      property: { ...base, staining: true },
      selections: [{ serviceId: "house_wash" }],
      channel: "widget",
      address: "2 Oak St, Tampa, FL",
    });
    expect(clean.result.needsOnsiteConfirmation).toBe(false);
    expect(flagged.result.needsOnsiteConfirmation).toBe(true);
    expect(flagged.result.total).toBe(clean.result.total);
    expect(flagged.result.displayMode).toBe("range");

    const { lead } = await createLead({
      business: pb,
      quoteId: flagged.id,
      name: "On Site Owner",
      phone: "8135550111",
      email: "onsite@example.com",
      smsConsent: false,
      address: "2 Oak St, Tampa, FL",
      total: flagged.result.total,
    });
    expect(lead.total).toBe(flagged.result.total);
  });
});
