import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { getDb } from "@/lib/db";
import { auditLog, businesses, users } from "@/lib/db/schema";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const db = await getDb();
  const rows = await db
    .select({ a: auditLog, email: users.email, name: businesses.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .leftJoin(businesses, eq(businesses.id, auditLog.businessId))
    .orderBy(desc(auditLog.id))
    .limit(300);
  return (
    <>
      <PageHeader title="Audit log" description="Every admin act-as, pricing change and settings change." />
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ a, email, name }) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{a.createdAt.toLocaleString()}</td>
                <td className="px-4 py-2">{email ?? "system"}</td>
                <td className="px-4 py-2">{name ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.action}</td>
                <td className="max-w-sm truncate px-4 py-2 font-mono text-xs text-zinc-500">{a.details ? JSON.stringify(a.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
