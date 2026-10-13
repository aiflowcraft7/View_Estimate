"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireBusiness } from "@/lib/auth";
import { canUseIntegration } from "@/lib/billing/plans";
import { decryptJson, encryptJson, randomToken } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { integrations, type IntegrationType } from "@/lib/db/schema";
import { flattenForGhl, type LeadPayload } from "@/lib/integrations/payload";
import type { WebhookCredentials } from "@/lib/integrations/sync";
import { assertSafeWebhookUrl, postSignedJson } from "@/lib/integrations/webhook";

export type IntegrationState = { ok?: string; error?: string };

async function upsert(businessId: string, type: IntegrationType, credentials: unknown) {
  const db = await getDb();
  await db
    .insert(integrations)
    .values({ businessId, type, credentials: encryptJson(credentials), status: "active" })
    .onConflictDoUpdate({ target: [integrations.businessId, integrations.type], set: { credentials: encryptJson(credentials), status: "active", lastError: null } });
}

function checkUrl(raw: string): string | null {
  try {
    assertSafeWebhookUrl(raw);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid URL";
  }
}

export async function saveWebhook(_: IntegrationState, form: FormData): Promise<IntegrationState> {
  const ctx = await requireBusiness();
  const url = z.string().trim().max(500).parse(form.get("url"));
  const err = checkUrl(url);
  if (err) return { error: err };
  const db = await getDb();
  const [existing] = await db.select().from(integrations).where(and(eq(integrations.businessId, ctx.business.id), eq(integrations.type, "webhook")));
  const secret = decryptJson<WebhookCredentials>(existing?.credentials)?.secret ?? `whsec_${randomToken(24)}`;
  await upsert(ctx.business.id, "webhook", { url, secret });
  await audit(ctx.user.id, ctx.business.id, "integration.webhook.save");
  revalidatePath("/app/integrations");
  return { ok: "Saved. New leads will be sent to this URL." };
}

export async function saveGhl(_: IntegrationState, form: FormData): Promise<IntegrationState> {
  const ctx = await requireBusiness();
  if (!canUseIntegration(ctx.business.plan, "ghl")) return { error: "GoHighLevel sync is on the Pro plan." };
  const url = z.string().trim().max(500).parse(form.get("url"));
  const err = checkUrl(url);
  if (err) return { error: err };
  await upsert(ctx.business.id, "ghl", { url });
  await audit(ctx.user.id, ctx.business.id, "integration.ghl.save");
  revalidatePath("/app/integrations");
  return { ok: "Saved. New leads will be sent to GoHighLevel." };
}

export async function removeIntegration(form: FormData) {
  const ctx = await requireBusiness();
  const type = z.enum(["webhook", "ghl", "jobber"]).parse(form.get("type"));
  const db = await getDb();
  await db.delete(integrations).where(and(eq(integrations.businessId, ctx.business.id), eq(integrations.type, type)));
  await audit(ctx.user.id, ctx.business.id, `integration.${type}.remove`);
  revalidatePath("/app/integrations");
}

function sampleLead(b: { id: string; name: string; slug: string }): LeadPayload {
  return {
    event: "lead.created",
    lead: {
      id: "00000000-0000-0000-0000-000000000000",
      createdAt: new Date().toISOString(),
      name: "Test Homeowner",
      firstName: "Test",
      lastName: "Homeowner",
      phone: "+18135550199",
      email: "test@example.com",
      address: "123 Test St, Tampa, FL 33602, USA",
      street: "123 Test St",
      city: "Tampa",
      state: "FL",
      zip: "33602",
      notes: "This is a test lead from ViewEstimate.",
      preferredWindow: "Any time",
      smsConsent: false,
      url: "https://example.com",
      photos: [],
    },
    quote: { id: null, total: 450, priceText: "$450", displayMode: "exact", needsOnsiteConfirmation: false, services: [{ id: "house_wash", name: "House wash", measure: "1,800 sq ft", total: 450 }], discount: null, sizeSource: "solar" },
    business: { id: b.id, name: b.name, slug: b.slug },
  };
}

export async function sendTest(_: IntegrationState, form: FormData): Promise<IntegrationState> {
  const ctx = await requireBusiness();
  const type = z.enum(["webhook", "ghl"]).parse(form.get("type"));
  const db = await getDb();
  const [i] = await db.select().from(integrations).where(and(eq(integrations.businessId, ctx.business.id), eq(integrations.type, type)));
  const creds = decryptJson<{ url: string; secret?: string }>(i?.credentials);
  if (!creds) return { error: "Save a URL first." };
  const payload = sampleLead(ctx.business);
  try {
    const r = await postSignedJson(creds.url, creds.secret ?? null, type === "ghl" ? flattenForGhl(payload) : payload, `test-${Date.now()}`, "lead.test");
    return { ok: `Test sent. The receiver answered ${r.status}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Test failed" };
  }
}
