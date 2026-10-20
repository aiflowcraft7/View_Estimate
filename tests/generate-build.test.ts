import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDemoBusiness, findClaimable } from "@/lib/business";
import { generateFromAnswers } from "@/lib/build/generate";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { sha256 } from "@/lib/crypto";

describe("createDemoBusiness (public unclaimed)", () => {
  it("creates a demo business with a claimable token", async () => {
    const name = `Build Co ${Date.now()}`;
    const { business, claimToken, claimUrl } = await createDemoBusiness({
      name,
      serviceIds: ["house_wash"],
      createdByAdmin: false,
    });
    expect(business.status).toBe("demo");
    expect(business.createdByAdmin).toBe(false);
    expect(business.onboardingComplete).toBe(true);
    expect(business.claimTokenHash).toBe(sha256(claimToken));
    expect(claimUrl).toContain(`/claim/${claimToken}`);

    const found = await findClaimable(claimToken);
    expect(found?.id).toBe(business.id);

    const db = await getDb();
    await db.delete(businesses).where(eq(businesses.id, business.id));
  });
});

describe("generateFromAnswers", () => {
  it("builds from short questions", async () => {
    const r = await generateFromAnswers({
      name: `Questions Wash ${Date.now()}`,
      serviceIds: ["house_wash", "windows"],
      zips: "28205",
      alertEmail: "owner@example.com",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.slug).toBeTruthy();
    const found = await findClaimable(r.claimToken);
    expect(found?.alertEmail).toBe("owner@example.com");
    expect(found?.serviceArea.zips).toContain("28205");
    const db = await getDb();
    if (found) await db.delete(businesses).where(eq(businesses.id, found.id));
  });

  it("rejects empty name", async () => {
    const r = await generateFromAnswers({ name: " ", serviceIds: ["house_wash"] });
    expect(r.ok).toBe(false);
  });
});
