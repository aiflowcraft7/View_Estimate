import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { deleteUserByClerkId, normalizeEmail, safeNext, upsertUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

describe("safeNext", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNext("/app/onboarding")).toBe("/app/onboarding");
    expect(safeNext("/app", "/admin")).toBe("/app");
    expect(safeNext("https://evil.com", "/app")).toBe("/app");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil")).toBe("/app");
    expect(safeNext(undefined, "/login")).toBe("/login");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });
});

describe("upsertUser", () => {
  it("links by clerk id, then attaches clerk id on email match", async () => {
    const clerkId = `user_test_${Date.now()}`;
    const email = `clerk${Date.now()}@example.com`;
    const first = await upsertUser(email, "Ada", clerkId);
    expect(first.clerkUserId).toBe(clerkId);
    expect(first.email).toBe(email);

    const again = await upsertUser("other@example.com", "Ada Two", clerkId);
    expect(again.id).toBe(first.id);
    expect(again.email).toBe("other@example.com");
    expect(again.name).toBe("Ada Two");

    const emailOnly = `plain${Date.now()}@example.com`;
    const plain = await upsertUser(emailOnly, "Plain");
    expect(plain.clerkUserId).toBeNull();
    const linked = await upsertUser(emailOnly, "Plain", `user_link_${Date.now()}`);
    expect(linked.id).toBe(plain.id);
    expect(linked.clerkUserId).toMatch(/^user_link_/);

    await deleteUserByClerkId(clerkId);
    const db = await getDb();
    const gone = await db.select().from(users).where(eq(users.clerkUserId, clerkId));
    expect(gone).toHaveLength(0);
  });
});
