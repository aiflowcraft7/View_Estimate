import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "./db";
import { auditLog, businesses, memberships, users } from "./db/schema";
import { env } from "./env";

const BUSINESS_COOKIE = "ve_business";
const ACTING_COOKIE = "ve_acting_business";

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

function primaryEmail(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>): string | null {
  const id = clerkUser.primaryEmailAddressId;
  const found = clerkUser.emailAddresses.find((e) => e.id === id)?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  return found ? normalizeEmail(found) : null;
}

function displayName(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>): string | null {
  const n = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
  return n || clerkUser.username || null;
}

/** Links Clerk identity to our users row (by clerk id, then email). */
export async function upsertUser(emailRaw: string, name?: string | null, clerkUserId?: string | null): Promise<User> {
  const email = normalizeEmail(emailRaw);
  const db = await getDb();
  const isAdmin = env.adminEmails.includes(email);

  if (clerkUserId) {
    const byClerk = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
    if (byClerk[0]) {
      const [user] = await db
        .update(users)
        .set({
          email,
          name: name ?? byClerk[0].name,
          lastLoginAt: new Date(),
          ...(isAdmin ? { isPlatformAdmin: true } : {}),
        })
        .where(eq(users.id, byClerk[0].id))
        .returning();
      return user;
    }
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: name ?? null,
      clerkUserId: clerkUserId ?? null,
      isPlatformAdmin: isAdmin,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        lastLoginAt: new Date(),
        ...(clerkUserId ? { clerkUserId } : {}),
        ...(name ? { name } : {}),
        ...(isAdmin ? { isPlatformAdmin: true } : {}),
      },
    })
    .returning();
  return user;
}

export async function deleteUserByClerkId(clerkUserId: string): Promise<void> {
  const db = await getDb();
  await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
}

async function resolveAppUser(clerkUserId: string): Promise<User | null> {
  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== clerkUserId) return null;
  const email = primaryEmail(clerkUser);
  if (!email) return null;
  return upsertUser(email, displayName(clerkUser), clerkUserId);
}

export type AppSession = {
  user: User;
  actingBusinessId: string | null;
};

export const getSession = cache(async (): Promise<AppSession | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await resolveAppUser(userId);
  if (!user) return null;
  const jar = await cookies();
  const actingBusinessId = jar.get(ACTING_COOKIE)?.value ?? null;
  return { user, actingBusinessId };
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

  if (s.user.isPlatformAdmin && s.actingBusinessId) {
    const [b] = await db.select().from(businesses).where(eq(businesses.id, s.actingBusinessId)).limit(1);
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

/** Admin "act as": switches context to a business and records it. */
export async function startActingAs(admin: User, businessId: string | null): Promise<void> {
  if (!admin.isPlatformAdmin) throw new Error("Not allowed");
  const jar = await cookies();
  if (businessId) {
    jar.set(ACTING_COOKIE, businessId, { httpOnly: true, sameSite: "lax", path: "/", secure: env.appUrl.startsWith("https://") });
  } else {
    jar.delete(ACTING_COOKIE);
  }
  await audit(admin.id, businessId, businessId ? "admin.act_as.start" : "admin.act_as.stop");
}

export async function audit(actorUserId: string | null, businessId: string | null, action: string, details?: Record<string, unknown>) {
  const db = await getDb();
  await db.insert(auditLog).values({ actorUserId, businessId, action, details: details ?? null });
}
