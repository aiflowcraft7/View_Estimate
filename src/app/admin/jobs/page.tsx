import { desc, inArray, sql } from "drizzle-orm";
import { Badge, Button, PageHeader } from "@/components/ui";
import { getDb } from "@/lib/db";
import { businesses, jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { dropJob, retryJobAction, runQueueNow } from "../actions";

export const metadata = { title: "Jobs" };

export default async function JobsPage() {
  const db = await getDb();
  const rows = await db
    .select({ j: jobs, name: businesses.name })
    .from(jobs)
    .leftJoin(businesses, eq(businesses.id, jobs.businessId))
    .where(inArray(jobs.status, ["dead", "pending", "running"]))
    .orderBy(desc(jobs.updatedAt))
    .limit(200);
  const counts = await db.select({ status: jobs.status, n: sql<number>`count(*)::int` }).from(jobs).groupBy(jobs.status);
  return (
    <>
      <PageHeader
        title="Jobs & webhooks"
        description={counts.map((c) => `${c.n} ${c.status}`).join(" · ") || "No jobs yet"}
        actions={
          <form action={runQueueNow}>
            <Button variant="secondary">Run due jobs now</Button>
          </form>
        }
      />
      <p className="mb-4 text-sm text-zinc-600">Alerts and CRM syncs retry with backoff (30s, 1m, 2m… up to 6h). Jobs that fail permanently or run out of attempts land here as &quot;dead&quot;.</p>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Last error</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ j, name }) => (
              <tr key={j.id}>
                <td className="px-4 py-3 font-mono text-xs">{j.type}</td>
                <td className="px-4 py-3">{name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge color={j.status === "dead" ? "red" : "amber"}>{j.status}</Badge>
                  {j.status === "pending" && <div className="text-xs text-zinc-500">next {j.runAt.toLocaleTimeString()}</div>}
                </td>
                <td className="px-4 py-3">
                  {j.attempts}/{j.maxAttempts}
                </td>
                <td className="max-w-md px-4 py-3 text-xs text-red-700">{j.lastError}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <form action={retryJobAction} className="inline">
                    <input type="hidden" name="id" value={j.id} />
                    <button className="text-sm font-medium text-brand-700">Retry</button>
                  </form>
                  <form action={dropJob} className="ml-3 inline">
                    <input type="hidden" name="id" value={j.id} />
                    <button className="text-sm text-zinc-500">Dismiss</button>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Nothing pending or failed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
