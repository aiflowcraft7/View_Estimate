import { eq } from "drizzle-orm";
import { Badge, Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { canUseIntegration } from "@/lib/billing/plans";
import { decryptJson } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { jobberEnabled } from "@/lib/integrations/jobber";
import { removeIntegration } from "./actions";
import { TestButton, UrlForm } from "./Forms";

export const metadata = { title: "Integrations" };

function StatusBadge({ i }: { i?: typeof integrations.$inferSelect }) {
  if (!i) return <Badge>Not connected</Badge>;
  if (i.lastError) return <Badge color="red">Error</Badge>;
  return <Badge color="green">Connected</Badge>;
}

function Remove({ type }: { type: string }) {
  return (
    <form action={removeIntegration}>
      <input type="hidden" name="type" value={type} />
      <Button variant="ghost" className="text-red-600">
        Disconnect
      </Button>
    </form>
  );
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ jobber?: string }> }) {
  const { business: b } = await requireBusiness();
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(integrations).where(eq(integrations.businessId, b.id));
  const by = (t: string) => rows.find((r) => r.type === t);
  const webhook = by("webhook");
  const ghl = by("ghl");
  const jobber = by("jobber");
  const wh = decryptJson<{ url: string; secret: string }>(webhook?.credentials);
  const ghlCreds = decryptJson<{ url: string }>(ghl?.credentials);
  const proOnly = !canUseIntegration(b.plan, "ghl");

  return (
    <>
      <PageHeader title="Integrations" description="Every new lead is sent to the tools you connect. Failed deliveries retry automatically." />
      {sp.jobber === "connected" && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Jobber is connected.</p>}
      {sp.jobber === "error" && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">Jobber connection failed. Please try again.</p>}
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Jobber</h2>
            <StatusBadge i={jobber} />
          </div>
          <p className="mt-1 text-sm text-zinc-600">Creates a client and a request in Jobber for every lead.</p>
          {jobber?.lastError && <p className="mt-2 text-sm text-red-700">{jobber.lastError}</p>}
          <div className="mt-3 flex gap-2">
            {proOnly ? (
              <p className="text-sm text-zinc-500">Available on the Pro plan.</p>
            ) : !jobberEnabled() ? (
              <p className="text-sm text-zinc-500">Jobber sync is coming soon. Use the webhook or Zapier below for now.</p>
            ) : jobber ? (
              <Remove type="jobber" />
            ) : (
              <LinkButton href="/api/integrations/jobber/connect" prefetch={false}>
                Connect Jobber
              </LinkButton>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">GoHighLevel</h2>
            <StatusBadge i={ghl} />
          </div>
          {proOnly ? (
            <p className="mt-1 text-sm text-zinc-500">Available on the Pro plan.</p>
          ) : (
            <>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
                <li>In GoHighLevel, create a Workflow with the trigger &quot;Inbound Webhook&quot; and copy its URL.</li>
                <li>Paste the URL below and click Save, then &quot;Send a test lead&quot;.</li>
                <li>Back in GoHighLevel, map the fields (first_name, phone, email, quote_total…) to a Create/Update Contact action and a Create Opportunity action.</li>
              </ol>
              <div className="mt-3">
                <UrlForm kind="ghl" url={ghlCreds?.url ?? ""} placeholder="https://services.leadconnectorhq.com/hooks/…" />
              </div>
              {ghl && (
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <TestButton kind="ghl" />
                  <Remove type="ghl" />
                </div>
              )}
              {ghl?.lastError && <p className="mt-2 text-sm text-red-700">Last error: {ghl.lastError}</p>}
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Webhook and Zapier</h2>
            <StatusBadge i={webhook} />
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Sends each lead as JSON to any URL. For Zapier, use the &quot;Webhooks by Zapier › Catch Hook&quot; trigger and paste its URL here. Works with Make, n8n, Housecall Pro automations and your own systems.
          </p>
          <div className="mt-3">
            <UrlForm kind="webhook" url={wh?.url ?? ""} placeholder="https://hooks.zapier.com/hooks/catch/…" />
          </div>
          {webhook && wh && (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-zinc-500">Signing secret</p>
                <code className="mt-1 block break-all rounded bg-zinc-100 px-3 py-2 text-xs">{wh.secret}</code>
                <p className="mt-1 text-xs text-zinc-500">
                  Each request has an <code>X-ViewEstimate-Signature: t=…,v1=…</code> header: HMAC-SHA256 of <code>&quot;t.body&quot;</code> with this secret.
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <TestButton kind="webhook" />
                <Remove type="webhook" />
              </div>
              {webhook.lastError && <p className="text-sm text-red-700">Last error: {webhook.lastError}</p>}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
