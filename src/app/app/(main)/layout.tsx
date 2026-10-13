import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { requireBusiness } from "@/lib/auth";
import { getSubscription } from "@/lib/business";
import { TRIAL_DAYS, widgetMode } from "@/lib/billing/plans";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { stopActingAs, switchBusiness } from "../actions";
import { Nav } from "./Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusiness();
  const b = ctx.business;
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.businessId, b.id), eq(leads.status, "new")));
  const sub = await getSubscription(b.id);
  const mode = widgetMode(b, sub);
  const trialDaysLeft = Math.ceil((b.createdAt.getTime() + TRIAL_DAYS * 86400_000 - Date.now()) / 86400_000);
  const onTrial = !sub && b.status !== "demo";

  return (
    <div className="min-h-dvh bg-zinc-50">
      {ctx.actingAsAdmin && (
        <div className="flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
          You are acting as {b.name}. Changes are logged.
          <form action={stopActingAs}>
            <button className="rounded bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-50">Stop</button>
          </form>
        </div>
      )}
      {mode === "requests_only" && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
          Your widget is collecting requests without prices because billing is inactive.{" "}
          <Link href="/app/billing" className="underline">
            Fix billing
          </Link>
        </div>
      )}
      {mode === "full" && onTrial && (
        <div className="bg-brand-800 px-4 py-2 text-center text-sm text-white">
          {trialDaysLeft > 0 ? `Free trial: ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left.` : "Your trial has ended."}{" "}
          <Link href="/app/billing" className="font-semibold underline">
            Choose a plan
          </Link>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-zinc-200 bg-white px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between lg:block">
            <Logo />
            <div className="lg:mt-6">
              <p className="truncate text-sm font-semibold text-zinc-900">{b.name}</p>
              {ctx.memberships.length > 1 && !ctx.actingAsAdmin && (
                <form action={switchBusiness} className="mt-1">
                  <select name="businessId" defaultValue={b.id} className="w-full rounded border-zinc-300 text-xs" aria-label="Switch business">
                    {ctx.memberships.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button className="mt-1 text-xs text-brand-700 underline">Switch</button>
                </form>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Nav newLeads={n} />
          </div>
          <div className="mt-6 hidden border-t border-zinc-100 pt-4 text-sm lg:block">
            <p className="truncate text-xs text-zinc-500">{ctx.user.email}</p>
            {ctx.user.isPlatformAdmin && (
              <Link href="/admin" className="mt-2 block text-zinc-600 hover:text-zinc-900">
                Admin console
              </Link>
            )}
            <form action="/logout" method="post" className="mt-2">
              <button className="text-zinc-600 hover:text-zinc-900">Sign out</button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
