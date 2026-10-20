import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { getBusinessContext, requireUser } from "@/lib/auth";
import { Wizard } from "./Wizard";
import Link from "next/link";

export const metadata: Metadata = { title: "Set up your business" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser("/app/onboarding");
  const ctx = await getBusinessContext();
  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-10">
      <div className="mx-auto mb-8 flex max-w-xl items-center justify-between">
        <Logo />
        {ctx ? (
          <Link href="/app" className="text-sm text-zinc-600 underline">
            Back to {ctx.business.name}
          </Link>
        ) : (
          <form action="/api/logout" method="post">
            <button className="text-sm text-zinc-500 hover:text-zinc-900">Sign out</button>
          </form>
        )}
      </div>
      <div className="mx-auto mb-6 max-w-xl">
        <h1 className="text-2xl font-bold">Set up instant quotes</h1>
        <p className="mt-1 text-sm text-zinc-600">Four quick steps. Your 14-day free trial starts now, no card needed.</p>
      </div>
      <Wizard email={user.email} />
    </main>
  );
}
