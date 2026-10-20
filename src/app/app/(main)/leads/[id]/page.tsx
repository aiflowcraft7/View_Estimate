import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Input, Select, Textarea, formatPhone, usd } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { integrations, leads, notifications, quotes } from "@/lib/db/schema";
import { SIDING_LABELS } from "@/lib/pricing/types";
import { fileUrl } from "@/lib/storage";
import { resyncLead, updateLead } from "../actions";
import { LEAD_STATUSES, statusColor } from "../status";

export const metadata = { title: "Lead" };

const SOURCE: Record<string, string> = { solar: "Satellite estimate", manual: "Entered by homeowner", band: "Size range picked by homeowner", none: "Unknown" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { business: b } = await requireBusiness();
  const db = await getDb();
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.businessId, b.id))).limit(1);
  if (!lead) notFound();
  const [quote] = lead.quoteId ? await db.select().from(quotes).where(eq(quotes.id, lead.quoteId)).limit(1) : [];
  const notes = await db.select().from(notifications).where(eq(notifications.leadId, lead.id)).orderBy(desc(notifications.createdAt));
  const hasIntegrations = (await db.select({ id: integrations.id }).from(integrations).where(eq(integrations.businessId, b.id)).limit(1)).length > 0;
  const fmt = (d: Date) => d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: b.timezone });
  const r = quote?.result;
  const p = quote?.property;

  return (
    <>
      <Link href="/app/leads" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Leads
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{lead.name}</h1>
        <Badge color={statusColor(lead.status)}>{lead.status}</Badge>
        <span className="text-sm text-zinc-500">{fmt(lead.createdAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-zinc-500">Phone</p>
                <a href={`tel:${lead.phone}`} className="font-medium text-brand-700">
                  {formatPhone(lead.phone)}
                </a>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Email</p>
                <a href={`mailto:${lead.email}`} className="font-medium text-brand-700 break-all">
                  {lead.email}
                </a>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-zinc-500">Address</p>
                <p className="font-medium">
                  {lead.address ?? "—"}{" "}
                  {lead.address && (
                    <a className="text-sm text-brand-700 underline" target="_blank" rel="noopener" href={quote?.lat != null ? `https://www.google.com/maps/search/?api=1&query=${quote.lat},${quote.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`}>
                      Map
                    </a>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Preferred time</p>
                <p>{lead.preferredWindow ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Texts to homeowner</p>
                <p>{lead.smsConsent ? `Consented ${lead.consentAt ? fmt(lead.consentAt) : ""}` : "No consent"}</p>
              </div>
              {lead.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-zinc-500">Homeowner notes</p>
                  <p className="whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </div>
            {lead.photos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {lead.photos.map((ph) => (
                  <a key={ph} href={fileUrl(ph)} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(ph)} alt="Homeowner photo" className="h-24 w-24 rounded-lg object-cover ring-1 ring-zinc-200" />
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Quote</h2>
              {r && (
                <p className="text-2xl font-bold">
                  {r.displayMode === "range" && r.range ? `${usd(r.range.low)} – ${usd(r.range.high)}` : usd(r.total)}
                </p>
              )}
            </div>
            {!r ? (
              <p className="mt-2 text-sm text-zinc-500">No price was shown (requests-only mode or outside your service area).</p>
            ) : (
              <>
                {r.needsOnsiteConfirmation && <p className="mt-1 text-sm text-amber-700">Needs on-site confirmation.</p>}
                <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                  {r.lines.map((l) => (
                    <li key={l.serviceId} className="py-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{l.name}</span>
                        <span>{usd(l.total)}</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {l.measureLabel}
                        {l.addons.length ? ` · ${l.addons.map((a) => `${a.name} ${usd(a.amount)}`).join(", ")}` : ""}
                        {l.minimumApplied ? " · minimum applied" : ""}
                        {l.notes.length ? ` · ${l.notes.join("; ")}` : ""}
                      </p>
                    </li>
                  ))}
                  {r.discount && (
                    <li className="flex justify-between py-2 text-emerald-700">
                      <span>{r.discount.name}</span>
                      <span>−{usd(r.discount.amount)}</span>
                    </li>
                  )}
                  {r.orderMinimumApplied && <li className="py-2 text-xs text-zinc-500">Order minimum applied</li>}
                </ul>
                {p && (
                  <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    Size: {p.livingSqft ? `${p.livingSqft.toLocaleString()} sq ft home` : p.footprintSqft ? `${p.footprintSqft.toLocaleString()} sq ft footprint` : "unknown"}, {p.stories}{" "}
                    {p.stories === 1 ? "story" : "stories"}
                    {p.roofSqft ? `, ${p.roofSqft.toLocaleString()} sq ft roof` : ""}
                    {p.roofPitchDegrees ? ` (${Math.round(p.roofPitchDegrees)}° pitch)` : ""}
                    {p.siding ? `, ${SIDING_LABELS[p.siding]} siding` : ""}
                    {p.staining ? ", visible staining" : ""}
                    {p.neglectedGutters ? ", gutters not cleaned in years" : ""}. Source: {SOURCE[p.source] ?? p.source}. Came from: {quote.channel}.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold">Activity</h2>
            {notes.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No alerts sent yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {notes.map((n) => (
                  <li key={n.id} className="flex flex-wrap gap-x-2">
                    <span className="text-zinc-500">{fmt(n.createdAt)}</span>
                    <span>
                      {n.kind === "lead_alert" ? "Alert" : "Homeowner confirmation"} {n.channel} to {n.to}
                    </span>
                    <Badge color={n.status === "sent" ? "green" : n.status === "failed" ? "red" : "gray"}>{n.status}</Badge>
                    {n.error && <span className="text-xs text-red-600">{n.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <form action={updateLead} className="space-y-4">
              <input type="hidden" name="id" value={lead.id} />
              <div>
                <label className="text-sm font-medium" htmlFor="status">
                  Status
                </label>
                <Select id="status" name="status" defaultValue={lead.status} className="capitalize">
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="bookedValue">
                  Booked value
                </label>
                <Input id="bookedValue" name="bookedValue" inputMode="decimal" defaultValue={lead.bookedValue ?? ""} placeholder={lead.total ? String(lead.total) : "0"} />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="internalNotes">
                  Private notes
                </label>
                <Textarea id="internalNotes" name="internalNotes" rows={4} defaultValue={lead.internalNotes ?? ""} />
              </div>
              <Button type="submit" className="w-full">
                Save
              </Button>
            </form>
          </Card>
          {hasIntegrations && (
            <Card>
              <p className="text-sm">
                CRM sync: <b>{lead.crmSyncStatus}</b>
              </p>
              <form action={resyncLead} className="mt-3">
                <input type="hidden" name="id" value={lead.id} />
                <Button variant="secondary" className="w-full">
                  Send to CRM again
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
