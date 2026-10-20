import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Badge, Card, LinkButton, PageHeader, usd } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { getSubscription } from "@/lib/business";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { funnel, funnelByChannel, setupChecklist, topServices } from "@/lib/stats";
import { statusColor } from "./leads/status";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { business: b } = await requireBusiness();
  const db = await getDb();
  const [f, recent, top, sub, channels] = await Promise.all([
    funnel(b.id, 30),
    db.select().from(leads).where(eq(leads.businessId, b.id)).orderBy(desc(leads.createdAt)).limit(6),
    topServices(b.id, 30),
    getSubscription(b.id),
    funnelByChannel(b.id, 30),
  ]);
  const checklist = await setupChecklist(b, !!sub && ["active", "trialing"].includes(sub.status));
  const remaining = checklist.filter((c) => !c.done);
  const pct = (a: number, z: number) => (z ? `${Math.round((a / z) * 100)}%` : "—");

  return (
    <>
      <PageHeader
        title={`Welcome back`}
        description="Last 30 days"
        actions={
          <LinkButton href={`/q/${b.slug}`} target="_blank" variant="secondary">
            Open my quote page
          </LinkButton>
        }
      />

      {remaining.length > 0 && (
        <Card className="mb-6">
          <h2 className="font-semibold">Finish setting up</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-3">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${c.done ? "bg-emerald-600 text-white" : "ring-1 ring-zinc-300"}`}>{c.done ? "✓" : ""}</span>
                {c.done ? (
                  <span className="text-zinc-500 line-through">{c.label}</span>
                ) : (
                  <Link href={c.href} className="font-medium text-brand-700 hover:underline">
                    {c.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Widget visits", f.views, ""],
          ["Addresses entered", f.addresses, pct(f.addresses, f.views)],
          ["Prices shown", f.quotes, pct(f.quotes, f.addresses)],
          ["Leads", f.leads, pct(f.leads, f.quotes)],
          ["Booked", f.booked, pct(f.booked, f.leads)],
        ].map(([label, value, rate]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {rate ? <p className="text-xs text-zinc-500">{rate} of previous step</p> : null}
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold">Where quotes come from</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-4 font-medium">Channel</th>
                <th className="py-1 pr-4 font-medium">Visits</th>
                <th className="py-1 pr-4 font-medium">Prices</th>
                <th className="py-1 font-medium">Leads</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channel} className="border-t border-zinc-100">
                  <td className="py-2 pr-4">{c.channel === "widget" ? "Website" : c.channel === "qr" ? "QR code" : "Quote page"}</td>
                  <td className="py-2 pr-4">{c.views}</td>
                  <td className="py-2 pr-4">{c.quotes}</td>
                  <td className="py-2">{c.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent leads</h2>
            <Link href="/app/leads" className="text-sm text-brand-700 hover:underline">
              All leads
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No leads yet. Share your{" "}
              <Link className="text-brand-700 underline" href="/app/install">
                quote page
              </Link>{" "}
              to get the first one.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {recent.map((l) => (
                <li key={l.id}>
                  <Link href={`/app/leads/${l.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-zinc-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="truncate text-xs text-zinc-500">{l.address ?? l.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold">{usd(l.total)}</span>
                      <Badge color={statusColor(l.status)}>{l.status}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <p className="text-xs text-zinc-500">Booked value</p>
            <p className="mt-1 text-2xl font-bold">{usd(f.bookedValue)}</p>
            <p className="mt-3 text-xs text-zinc-500">Quoted to leads</p>
            <p className="mt-1 text-lg font-semibold">{usd(f.quotedValue)}</p>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">Top services</h2>
            {top.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No data yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {top.map(([name, n]) => (
                  <li key={name} className="flex justify-between">
                    <span>{name}</span>
                    <span className="text-zinc-500">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
