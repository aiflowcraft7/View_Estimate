import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { businesses } from "./db/schema";
import { DEFAULT_PRICING } from "./pricing/templates";

export const DEMO_SLUG = "demo";

/** The public demo business shown on the marketing site (/demo). Created on first use. */
export async function ensureDemoBusiness() {
  const db = await getDb();
  const [existing] = await db.select().from(businesses).where(eq(businesses.slug, DEMO_SLUG)).limit(1);
  if (existing) return existing;
  const [b] = await db
    .insert(businesses)
    .values({
      slug: DEMO_SLUG,
      name: "Sunshine Soft Wash (demo)",
      headline: "Instant prices for house, roof and driveway cleaning",
      brandColor: "#0e7490",
      phone: "(813) 555-0142",
      pricing: DEFAULT_PRICING,
      status: "demo",
      createdByAdmin: true,
      onboardingComplete: true,
      claimedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  return b ?? (await db.select().from(businesses).where(eq(businesses.slug, DEMO_SLUG)).limit(1))[0];
}
