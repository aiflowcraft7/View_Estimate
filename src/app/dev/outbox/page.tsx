import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { devOutbox } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Dev outbox", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Emails and texts captured while Resend/Twilio keys are missing. Open in development; admins only in production. */
export default async function OutboxPage() {
  if (env.isProduction) {
    const s = await getSession();
    if (!s?.user.isPlatformAdmin) notFound();
  }
  const db = await getDb();
  const rows = await db.select().from(devOutbox).orderBy(desc(devOutbox.createdAt)).limit(50);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Dev outbox</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Messages land here because {env.resendKey ? "" : "RESEND_API_KEY"}
        {!env.resendKey && !env.twilioSid ? " and " : ""}
        {env.twilioSid ? "" : "Twilio keys"} are not set. Newest first.
      </p>
      <div className="mt-6 space-y-4">
        {rows.length === 0 && <p className="text-sm text-zinc-500">Nothing yet.</p>}
        {rows.map((r) => (
          <article key={r.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-100 px-4 py-3 text-sm">
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold uppercase">{r.channel}</span>
              <span className="font-medium">{r.to}</span>
              <span className="text-zinc-500">{r.createdAt.toLocaleString()}</span>
              {r.subject && <span className="w-full font-semibold">{r.subject}</span>}
            </header>
            {r.html ? (
              <iframe title={r.subject ?? "email"} srcDoc={`<base target="_top">${r.html}`} sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" className="h-[420px] w-full" />
            ) : (
              <p className="whitespace-pre-wrap px-4 py-3 text-sm">{r.body}</p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
