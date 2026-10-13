import { desc, ilike, or, sql } from "drizzle-orm";
import Link from "next/link";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { getDb } from "@/lib/db";
import { businesses, leads } from "@/lib/db/schema";

export const metadata = { title: "Businesses" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86400_000);
  const rows = await db
    .select({
      b: businesses,
      leads30: sql<number>`(select count(*)::int from ${leads} where ${leads.businessId} = ${businesses.id} and ${leads.createdAt} >= ${since})`,
      owners: sql<string>`(select string_agg(u.email, ', ') from memberships m join users u on u.id = m.user_id where m.business_id = ${businesses.id})`,
    })
    .from(businesses)
    .where(q ? or(ilike(businesses.name, `%${q}%`), ilike(businesses.slug, `%${q}%`)) : undefined)
    .orderBy(desc(businesses.createdAt))
    .limit(300);
  const color = (s: string) => (s === "active" ? "green" : s === "trial" ? "blue" : s === "demo" ? "teal" : s === "past_due" ? "amber" : "gray") as "green";
  return (
    <>
      <PageHeader title="Businesses" description={`${rows.length} shown`} actions={<LinkButton href="/admin/new">New demo business</LinkButton>} />
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Search name or slug" className="w-72 rounded-lg border-0 px-3 py-1.5 text-sm ring-1 ring-zinc-300" />
      </form>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Leads (30d)</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ b, leads30, owners }) => (
              <tr key={b.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/b/${b.id}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                  <div className="text-xs text-zinc-500">/{b.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge color={color(b.status)}>{b.status}</Badge>
                </td>
                <td className="px-4 py-3 capitalize">{b.plan}</td>
                <td className="px-4 py-3">{leads30}</td>
                <td className="max-w-[16rem] truncate px-4 py-3 text-zinc-600">{owners ?? (b.claimTokenHash ? "Unclaimed" : "—")}</td>
                <td className="px-4 py-3 text-zinc-500">{b.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
