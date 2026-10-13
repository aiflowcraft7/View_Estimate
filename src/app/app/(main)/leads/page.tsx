import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { Badge, EmptyState, LinkButton, PageHeader, formatPhone, usd } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leads, type LeadStatus } from "@/lib/db/schema";
import { LEAD_STATUSES, statusColor } from "./status";

export const metadata = { title: "Leads" };
const PAGE = 50;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { business: b } = await requireBusiness();
  const sp = await searchParams;
  const status = LEAD_STATUSES.includes(sp.status as LeadStatus) ? (sp.status as LeadStatus) : undefined;
  const q = sp.q?.trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);

  const where: SQL[] = [eq(leads.businessId, b.id)];
  if (status) where.push(eq(leads.status, status));
  if (q) where.push(or(ilike(leads.name, `%${q}%`), ilike(leads.email, `%${q}%`), ilike(leads.phone, `%${q}%`), ilike(leads.address, `%${q}%`))!);

  const db = await getDb();
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(and(...where)).orderBy(desc(leads.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ total: sql<number>`count(*)::int` }).from(leads).where(and(...where)),
  ]);
  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q, ...p })) if (v) u.set(k, v);
    return `?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${total} lead${total === 1 ? "" : "s"}`}
        actions={
          <LinkButton variant="secondary" href={`/app/leads-export${qs({})}`} prefetch={false}>
            Export CSV
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {[undefined, ...LEAD_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={qs({ status: s, page: undefined })}
              className={`rounded-full px-3 py-1 text-sm capitalize ${s === status ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}
            >
              {s ?? "All"}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search name, phone, address" className="w-64 rounded-lg border-0 px-3 py-1.5 text-sm ring-1 ring-zinc-300" />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={q || status ? "No leads match" : "No leads yet"}>{!q && !status && "When a homeowner requests a booking, it shows up here and you get an alert."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">CRM</th>
                <th className="px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/app/leads/${l.id}`} className="font-medium text-zinc-900 hover:underline">
                      {l.name}
                    </Link>
                    <div className="text-xs text-zinc-500">{formatPhone(l.phone)}</div>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-zinc-600">{l.address ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{usd(l.total)}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(l.status)}>{l.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{l.crmSyncStatus === "none" ? "—" : l.crmSyncStatus}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{l.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: b.timezone })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Newer</Link> : <span />}
          {page * PAGE < total ? <Link href={qs({ page: String(page + 1) })}>Older →</Link> : <span />}
        </div>
      )}
    </>
  );
}
