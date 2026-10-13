import { desc, eq, ne, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Input, Notice, Select } from "@/components/ui";
import { getSubscription } from "@/lib/business";
import { getDb } from "@/lib/db";
import { auditLog, businesses, integrations, memberships, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { funnel } from "@/lib/stats";
import { actAs, copyPricing, deleteBusiness, regenerateClaim, updateBusinessAdmin } from "../../actions";

export const metadata = { title: "Business" };

export default async function AdminBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ claim?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
  if (!b) notFound();
  const [owners, f, sub, integ, log, others] = await Promise.all([
    db.select({ email: users.email, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.businessId, id)),
    funnel(id, 30),
    getSubscription(id),
    db.select({ type: integrations.type, lastError: integrations.lastError, lastSyncAt: integrations.lastSyncAt }).from(integrations).where(eq(integrations.businessId, id)),
    db.select().from(auditLog).where(eq(auditLog.businessId, id)).orderBy(desc(auditLog.id)).limit(20),
    db.select({ id: businesses.id, name: businesses.name, n: sql<number>`jsonb_array_length(${businesses.pricing}->'services')` }).from(businesses).where(ne(businesses.id, id)).orderBy(businesses.name).limit(500),
  ]);

  return (
    <>
      <Link href="/admin" className="text-sm text-zinc-500">
        ← Businesses
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{b.name}</h1>
        <Badge>{b.status}</Badge>
        <Badge color="teal">{b.plan}</Badge>
        <a href={`/q/${b.slug}`} target="_blank" rel="noopener" className="text-sm text-brand-700 underline">
          /q/{b.slug}
        </a>
      </div>
      {sp.claim && (
        <div className="mb-4">
          <Notice tone="success">
            New claim link (previous one no longer works): <code className="break-all">{sp.claim}</code>
          </Notice>
        </div>
      )}
      {sp.error === "confirm" && (
        <div className="mb-4">
          <Notice tone="error">Type DELETE to confirm.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap gap-3">
              <form action={actAs}>
                <input type="hidden" name="id" value={b.id} />
                <Button>Act as this business</Button>
              </form>
              {!b.claimedAt && (
                <form action={regenerateClaim}>
                  <input type="hidden" name="id" value={b.id} />
                  <Button variant="secondary">New claim link</Button>
                </form>
              )}
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Owners</dt>
                <dd>{owners.length ? owners.map((o) => `${o.email} (${o.role})`).join(", ") : "Unclaimed"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Alerts</dt>
                <dd>
                  {b.alertEmail ?? "no email"} · {b.alertPhone ?? "no phone"} {b.smsAlertsEnabled ? "(SMS on)" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Subscription</dt>
                <dd>{sub ? `${sub.status} · ${sub.plan ?? sub.priceId} · ${sub.paddleSubscriptionId ?? ""}` : "None"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Integrations</dt>
                <dd>{integ.length ? integ.map((i) => `${i.type}${i.lastError ? " (error)" : ""}`).join(", ") : "None"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Last 30 days</dt>
                <dd>
                  {f.views} views · {f.quotes} quotes · {f.leads} leads · {f.booked} booked
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Created</dt>
                <dd>{b.createdAt.toLocaleString()}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h2 className="font-semibold">Recent activity</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {log.map((l) => (
                <li key={l.id} className="text-zinc-600">
                  <span className="text-zinc-400">{l.createdAt.toLocaleString()}</span> {l.action}
                </li>
              ))}
              {!log.length && <li className="text-zinc-500">Nothing yet.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Account</h2>
            <form action={updateBusinessAdmin} className="space-y-3">
              <input type="hidden" name="id" value={b.id} />
              <label className="block text-sm">
                Status
                <Select name="status" defaultValue={b.status}>
                  {["demo", "trial", "active", "past_due", "paused", "canceled"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                Plan
                <Select name="plan" defaultValue={b.plan}>
                  {["starter", "pro", "founding"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                Monthly quote cap
                <Input name="monthlyQuoteCap" type="number" defaultValue={b.monthlyQuoteCap} />
              </label>
              <Button variant="secondary" className="w-full">
                Save
              </Button>
            </form>
            <p className="mt-2 text-xs text-zinc-500">Paddle webhooks overwrite status and plan when the subscription changes.</p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Copy pricing from</h2>
            <form action={copyPricing} className="space-y-3">
              <input type="hidden" name="id" value={b.id} />
              <Select name="from">
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.n} services)
                  </option>
                ))}
              </Select>
              <Button variant="secondary" className="w-full">
                Replace this business&apos;s pricing
              </Button>
            </form>
          </Card>
          {b.slug !== "demo" && (
            <Card>
              <h2 className="mb-2 font-semibold text-red-700">Delete business</h2>
              <p className="mb-3 text-xs text-zinc-500">Deletes the business and all its quotes, leads and photos records. This can&apos;t be undone.</p>
              <form action={deleteBusiness} className="space-y-2">
                <input type="hidden" name="id" value={b.id} />
                <Input name="confirm" placeholder="Type DELETE" />
                <Button variant="danger" className="w-full">
                  Delete
                </Button>
              </form>
            </Card>
          )}
          <p className="text-xs text-zinc-500">Support inbox: {env.supportEmail}</p>
        </div>
      </div>
    </>
  );
}
