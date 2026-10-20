import "server-only";
import { and, eq, isNull, like } from "drizzle-orm";
import { randomToken, sha256 } from "./crypto";
import { getDb } from "./db";
import { businesses, memberships, subscriptions, type ServiceArea } from "./db/schema";
import { DEFAULT_PRICING, templateFor } from "./pricing/templates";
import type { PricingConfig } from "./pricing/types";
import { env } from "./env";

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "business"
  );
}

const RESERVED = new Set(["admin", "app", "api", "embed", "q", "login", "demo", "pricing", "w", "www", "help", "support", "build", "p", "claim"]);

export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const db = await getDb();
  const taken = new Set((await db.select({ slug: businesses.slug }).from(businesses).where(like(businesses.slug, `${base}%`))).map((r) => r.slug));
  if (!taken.has(base) && !RESERVED.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${randomToken(4).toLowerCase()}`;
}

export type NewBusinessInput = {
  name: string;
  phone?: string | null;
  website?: string | null;
  alertEmail?: string | null;
  alertPhone?: string | null;
  brandColor?: string;
  logoUrl?: string | null;
  serviceIds?: string[];
  pricing?: PricingConfig;
  serviceArea?: ServiceArea;
  timezone?: string;
};

export async function createBusinessForUser(userId: string, input: NewBusinessInput) {
  const db = await getDb();
  const slug = await uniqueSlug(input.name);
  const [b] = await db
    .insert(businesses)
    .values({
      slug,
      name: input.name.trim(),
      phone: input.phone ?? null,
      website: input.website ?? null,
      alertEmail: input.alertEmail ?? null,
      alertPhone: input.alertPhone ?? null,
      brandColor: input.brandColor ?? "#0f766e",
      logoUrl: input.logoUrl ?? null,
      pricing: input.pricing ?? (input.serviceIds?.length ? templateFor(input.serviceIds) : DEFAULT_PRICING),
      serviceArea: input.serviceArea ?? {},
      timezone: input.timezone ?? "America/New_York",
      status: "trial",
    })
    .returning();
  await db.insert(memberships).values({ userId, businessId: b.id, role: "owner" });
  return b;
}

/**
 * Unclaimed live business (public /build or admin demo). No owner yet; claim token
 * lets the creator fine-tune on /p/[slug] and Activate into a trial.
 */
export async function createUnclaimedBusiness(input: NewBusinessInput & { createdByAdmin?: boolean }) {
  const db = await getDb();
  const slug = await uniqueSlug(input.name);
  const claimToken = randomToken(24);
  const [b] = await db
    .insert(businesses)
    .values({
      slug,
      name: input.name.trim(),
      phone: input.phone ?? null,
      website: input.website ?? null,
      alertEmail: input.alertEmail ?? null,
      brandColor: input.brandColor ?? "#0f766e",
      logoUrl: input.logoUrl ?? null,
      pricing: input.pricing ?? (input.serviceIds?.length ? templateFor(input.serviceIds) : DEFAULT_PRICING),
      serviceArea: input.serviceArea ?? {},
      timezone: input.timezone ?? "America/New_York",
      status: "demo",
      createdByAdmin: !!input.createdByAdmin,
      claimTokenHash: sha256(claimToken),
      onboardingComplete: true,
    })
    .returning();
  return { business: b, claimToken, claimUrl: `${env.appUrl}/claim/${claimToken}` };
}

/** Admin demo builder (default) or public /build unclaimed page. */
export async function createDemoBusiness(input: NewBusinessInput & { createdByAdmin?: boolean }) {
  return createUnclaimedBusiness({ ...input, createdByAdmin: input.createdByAdmin ?? true });
}

export async function newClaimLink(businessId: string): Promise<string> {
  const token = randomToken(24);
  const db = await getDb();
  await db.update(businesses).set({ claimTokenHash: sha256(token), updatedAt: new Date() }).where(eq(businesses.id, businessId));
  return `${env.appUrl}/claim/${token}`;
}

export async function findClaimable(token: string) {
  const db = await getDb();
  const [b] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.claimTokenHash, sha256(token)), isNull(businesses.claimedAt)))
    .limit(1);
  return b ?? null;
}

/** Transfers a demo business to the signed-in owner and starts their trial. */
export async function claimBusiness(token: string, userId: string, email: string) {
  const db = await getDb();
  const b = await findClaimable(token);
  if (!b) return null;
  const [updated] = await db
    .update(businesses)
    .set({
      claimedAt: new Date(),
      claimTokenHash: null,
      status: "trial",
      createdAt: new Date(), // trial clock starts at claim time
      alertEmail: b.alertEmail ?? email,
      onboardingComplete: true, // the admin already set prices and branding
      updatedAt: new Date(),
    })
    .where(and(eq(businesses.id, b.id), isNull(businesses.claimedAt)))
    .returning();
  if (!updated) return null;
  await db.insert(memberships).values({ userId, businessId: b.id, role: "owner" }).onConflictDoNothing();
  return updated;
}

export async function getSubscription(businessId: string) {
  const db = await getDb();
  const [s] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1);
  return s ?? null;
}
