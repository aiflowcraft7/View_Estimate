import { and, eq, gte, sql } from "drizzle-orm";
import { Badge, Card, PageHeader, usd } from "@/components/ui";
import { getDb } from "@/lib/db";
import { apiUsage, businesses, jobs, leads, notifications, subscriptions } from "@/lib/db/schema";
import { env, serviceStatus } from "@/lib/env";

export const metadata = { title: "Health" };

// Prices above free tiers (Oct 2026). Google gives 10,000 free calls per SKU per month.
const COST = { solar: 10 / 1000, places_details: 5 / 1000, places_autocomplete: 2.83 / 1000, sms_segments: 0.0125 };

export default async function HealthPage() {
  const db = await getDb();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthDay = monthStart.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const usage = await db
    .select({ kind: apiUsage.kind, month: sql<number>`sum(${apiUsage.count})::int`, today: sql<number>`sum(${apiUsage.count}) filter (where ${apiUsage.day} = ${today})::int` })
    .from(apiUsage)
    .where(and(eq(apiUsage.scope, "global"), gte(apiUsage.day, monthDay)))
    .groupBy(apiUsage.kind);
  const smsMonth = await db
    .select({ n: sql<number>`coalesce(sum(${notifications.segments}),0)::int` })
    .from(notifications)
    .where(and(eq(notifications.channel, "sms"), eq(notifications.status, "sent"), gte(notifications.createdAt, monthStart)));
  const [dead] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.status, "dead"));
  const [failedAlerts] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.status, "failed"), gte(notifications.createdAt, new Date(Date.now() - 7 * 86400_000))));
  const [counts] = await db
    .select({
      businesses: sql<number>`count(*)::int`,
      paying: sql<number>`(select count(*)::int from ${subscriptions} where ${subscriptions.status} in ('active','past_due'))`,
      leadsMonth: sql<number>`(select count(*)::int from ${leads} where ${leads.createdAt} >= ${monthStart})`,
    })
    .from(businesses);

  const get = (k: string) => usage.find((u) => u.kind === k);
  const est = (k: keyof typeof COST, n: number) => (k === "sms_segments" ? n * COST[k] : Math.max(0, n - 10000) * COST[k]);

  return (
    <>
      <PageHeader title="Health & costs" />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-zinc-500">Businesses</p>
          <p className="text-2xl font-bold">{counts.businesses}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Paying</p>
          <p className="text-2xl font-bold">{counts.paying}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Leads this month</p>
          <p className="text-2xl font-bold">{counts.leadsMonth}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-500">Dead jobs / failed alerts (7d)</p>
          <p className={`text-2xl font-bold ${dead.n || failedAlerts.n ? "text-red-600" : ""}`}>
            {dead.n} / {failedAlerts.n}
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold">Paid API usage this month</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-1">API</th>
              <th>Today</th>
              <th>This month</th>
              <th>Estimated cost</th>
            </tr>
          </thead>
          <tbody>
            {(["places_autocomplete", "places_details", "solar"] as const).map((k) => (
              <tr key={k} className="border-t border-zinc-100">
                <td className="py-2">{k}</td>
                <td>{get(k)?.today ?? 0}</td>
                <td>{get(k)?.month ?? 0}</td>
                <td>{usd(est(k, get(k)?.month ?? 0))}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-100">
              <td className="py-2">SMS segments</td>
              <td>—</td>
              <td>{smsMonth[0]?.n ?? 0}</td>
              <td>{usd(est("sms_segments", smsMonth[0]?.n ?? 0))}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-zinc-500">
          Daily Google budget: {env.googleDailyCallBudget} Solar + Details calls each (GOOGLE_DAILY_CALL_BUDGET). Autocomplete sessions that end in a Details call are free. Also set a budget alert in Google Cloud.
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold">Services</h2>
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {serviceStatus().map((s) => (
            <li key={s.name} className="flex items-center justify-between py-2">
              <span>{s.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-zinc-500">{s.note}</span>
                <Badge color={s.live ? "green" : "amber"}>{s.live ? "live" : "stand-in"}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
