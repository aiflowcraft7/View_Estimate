import "server-only";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomToken, sha256 } from "./crypto";
import { getDb } from "./db";
import { auditLog, businesses, loginTokens, memberships, sessions, users } from "./db/schema";
import { env } from "./env";
import { sendEmail } from "./messaging/email";
import { magicLinkEmail } from "./messaging/templates";

const SESSION_COOKIE = "ve_session";
const BUSINESS_COOKIE = "ve_business";
const SESSION_DAYS = 30;
const MAGIC_MINUTES = 20;

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export async function requestMagicLink(emailRaw: string, next?: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const token = randomToken();
  const db = await getDb();
  await db.insert(loginTokens).values({
    tokenHash: sha256(token),
    email,
    redirectTo: safeNext(next),
    expiresAt: new Date(Date.now() + MAGIC_MINUTES * 60_000),
  });
  const url = `${env.appUrl}/auth/verify?token=${encodeURIComponent(token)}`;
  const res = await sendEmail(magicLinkEmail(email, url));
  if (!res.ok) throw new Error(`Could not send sign-in email: ${res.error}`);
}

/** Consumes a magic link token. Returns the redirect target, or null if invalid/expired/used. */
export async function consumeMagicLink(token: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(loginTokens.tokenHash, sha256(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())))
    .returning();
  const row = rows[0];
  if (!row) return null;
  const user = await upsertUser(row.email);
  await createSession(user.id);
  return row.redirectTo ?? "/app";
}

export async function upsertUser(emailRaw: string, name?: string | null): Promise<User> {
  const email = normalizeEmail(emailRaw);
  const db = await getDb();
  const isAdmin = env.adminEmails.includes(email);
  const [user] = await db
    .insert(users)
    .values({ email, name: name ?? null, isPlatformAdmin: isAdmin, lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: users.email, set: { lastLoginAt: new Date(), ...(isAdmin ? { isPlatformAdmin: true } : {}) } })
    .returning();
  return user;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const db = await getDb();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(BUSINESS_COOKIE);
}

export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
});

export async function requireUser(next = "/app"): Promise<User> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s.user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser("/admin");
  if (!user.isPlatformAdmin) redirect("/app");
  return user;
}

export type BusinessContext = {
  user: User;
  business: Business;
  role: "owner" | "staff" | "admin";
  /** True when a platform admin is acting as this business. */
  actingAsAdmin: boolean;
  memberships: { id: string; name: string }[];
};

/**
 * Resolves which business the signed-in user is working on. Tenant isolation
 * for the owner app rests on this: every owner query is scoped to
 * ctx.business.id, which only comes from a membership row or an audited
 * admin act-as session.
 */
export const getBusinessContext = cache(async (): Promise<BusinessContext | null> => {
  const s = await getSession();
  if (!s) return null;
  const db = await getDb();
  const mine = await db
    .select({ id: businesses.id, name: businesses.name, role: memberships.role })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, s.user.id))
    .orderBy(asc(memberships.createdAt));

  if (s.user.isPlatformAdmin && s.session.actingBusinessId) {
    const [b] = await db.select().from(businesses).where(eq(businesses.id, s.session.actingBusinessId)).limit(1);
    if (b) return { user: s.user, business: b, role: "admin", actingAsAdmin: true, memberships: mine };
  }

  if (!mine.length) return null;
  const jar = await cookies();
  const preferred = jar.get(BUSINESS_COOKIE)?.value;
  const pick = mine.find((m) => m.id === preferred) ?? mine[0];
  const [b] = await db.select().from(businesses).where(eq(businesses.id, pick.id)).limit(1);
  if (!b) return null;
  return { user: s.user, business: b, role: pick.role, actingAsAdmin: false, memberships: mine };
});

export async function requireBusiness(): Promise<BusinessContext> {
  await requireUser();
  const ctx = await getBusinessContext();
  if (!ctx) redirect("/app/onboarding");
  return ctx;
}

export async function setActiveBusiness(businessId: string): Promise<void> {
  const jar = await cookies();
  jar.set(BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", path: "/", secure: env.appUrl.startsWith("https://") });
}

/** Admin "act as": switches the admin's session to a business and records it. */
export async function startActingAs(admin: User, businessId: string | null): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !admin.isPlatformAdmin) throw new Error("Not allowed");
  const db = await getDb();
  await db.update(sessions).set({ actingBusinessId: businessId }).where(eq(sessions.id, sha256(token)));
  await audit(admin.id, businessId, businessId ? "admin.act_as.start" : "admin.act_as.stop");
}

export async function audit(actorUserId: string | null, businessId: string | null, action: string, details?: Record<string, unknown>) {
  const db = await getDb();
  await db.insert(auditLog).values({ actorUserId, businessId, action, details: details ?? null });
}
