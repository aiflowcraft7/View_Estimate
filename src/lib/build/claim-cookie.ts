import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sha256 } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const BUILD_CLAIM_COOKIE = "ve_build_claim";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export const buildClaimCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export function attachBuildClaimCookie(res: NextResponse, claimToken: string) {
  res.cookies.set(BUILD_CLAIM_COOKIE, claimToken, buildClaimCookieOptions);
}

export async function setBuildClaimCookie(claimToken: string) {
  const jar = await cookies();
  jar.set(BUILD_CLAIM_COOKIE, claimToken, buildClaimCookieOptions);
}

export async function clearBuildClaimCookie() {
  const jar = await cookies();
  jar.delete(BUILD_CLAIM_COOKIE);
}

export async function getBuildClaimToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(BUILD_CLAIM_COOKIE)?.value ?? null;
}

/** Returns the unclaimed business for slug if the claim cookie matches. */
export async function getEditableUnclaimed(slug: string) {
  const token = await getBuildClaimToken();
  if (!token) return null;
  const db = await getDb();
  const [b] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug.toLowerCase()), eq(businesses.claimTokenHash, sha256(token)), isNull(businesses.claimedAt)))
    .limit(1);
  return b ? { business: b, claimToken: token } : null;
}
