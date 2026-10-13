import { and, desc, eq } from "drizzle-orm";
import { getBusinessContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leads, quotes, type LeadStatus } from "@/lib/db/schema";

function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const ctx = await getBusinessContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const status = new URL(req.url).searchParams.get("status") as LeadStatus | null;
  const db = await getDb();
  const rows = await db
    .select({ lead: leads, quote: quotes })
    .from(leads)
    .leftJoin(quotes, eq(quotes.id, leads.quoteId))
    .where(and(eq(leads.businessId, ctx.business.id), status ? eq(leads.status, status) : undefined))
    .orderBy(desc(leads.createdAt))
    .limit(10000);
  const header = ["created_at", "name", "phone", "email", "address", "services", "price", "status", "preferred_time", "notes", "size_source", "sms_consent", "channel"];
  const lines = rows.map(({ lead: l, quote: q }) =>
    [
      l.createdAt.toISOString(),
      l.name,
      l.phone,
      l.email,
      l.address,
      q?.result.lines.map((x) => x.name).join("; "),
      l.total,
      l.status,
      l.preferredWindow,
      l.notes,
      q?.property.source,
      l.smsConsent ? "yes" : "no",
      q?.channel,
    ]
      .map(cell)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${ctx.business.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
