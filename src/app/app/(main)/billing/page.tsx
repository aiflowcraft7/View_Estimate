import { Badge, Button, Card, Notice, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { getSubscription } from "@/lib/business";
import { paddleLive } from "@/lib/billing/paddle";
import { PLANS, TRIAL_DAYS, widgetMode } from "@/lib/billing/plans";
import { env } from "@/lib/env";
import { openPortal, setBranding, simulateSubscribe } from "./actions";
import { CheckoutButton } from "./Checkout";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; simulated?: string; portal?: string; annual?: string }> }) {
  const { business: b, user } = await requireBusiness();
  const sp = await searchParams;
  const sub = await getSubscription(b.id);
  const mode = widgetMode(b, sub);
  const live = paddleLive();
  const annual = sp.annual === "1";
  const prices = env.paddlePrices;
  const priceFor = (plan: "starter" | "pro") => (plan === "starter" ? (annual ? prices.starter_annual : prices.starter_monthly) : annual ? prices.pro_annual : prices.pro_monthly);
  const subscribed = sub && ["active", "trialing", "past_due"].includes(sub.status);
  const trialEnds = new Date(b.createdAt.getTime() + TRIAL_DAYS * 86400_000);

  return (
    <>
      <PageHeader title="Billing" />
      {sp.checkout === "success" && (
        <div className="mb-4">
          <Notice tone="success">Thanks! Your subscription is being activated. This page updates within a minute.</Notice>
        </div>
      )}
      {sp.portal === "error" && (
        <div className="mb-4">
          <Notice tone="error">We couldn&apos;t open the billing portal. Please try again or contact support.</Notice>
        </div>
      )}
      {!live && (
        <div className="mb-4">
          <Notice tone="warn">Payments aren&apos;t connected yet (Paddle keys missing). {env.isProduction ? "Contact support to subscribe." : "You can simulate a subscription below to test the app."}</Notice>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Current plan: {PLANS[b.plan].name}</h2>
          <Badge color={mode === "full" ? "green" : "red"}>{subscribed ? sub!.status : b.status === "demo" ? "demo" : "free trial"}</Badge>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          {subscribed
            ? sub!.status === "past_due"
              ? "Your last payment failed. Update your card to keep prices showing on your widget."
              : sub!.currentPeriodEnd
                ? `Renews ${sub!.currentPeriodEnd.toLocaleDateString()}.`
                : "Active."
            : sub?.status === "canceled"
              ? `Canceled. ${mode === "full" ? "Prices keep showing until the end of your paid period." : "Your widget now collects requests without prices."}`
              : `Free trial ${trialEnds > new Date() ? `ends ${trialEnds.toLocaleDateString()}` : "has ended"}. Pick a plan to keep instant prices on.`}
        </p>
        {sub?.paddleCustomerId && live && (
          <form action={openPortal} className="mt-3">
            <Button variant="secondary">Manage payment method, invoices or cancel</Button>
          </form>
        )}
      </Card>

      {!subscribed && (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <a href="/app/billing" className={`rounded-full px-3 py-1 ${!annual ? "bg-zinc-900 text-white" : "ring-1 ring-zinc-300"}`}>
              Monthly
            </a>
            <a href="/app/billing?annual=1" className={`rounded-full px-3 py-1 ${annual ? "bg-zinc-900 text-white" : "ring-1 ring-zinc-300"}`}>
              Yearly (2 months free)
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(["starter", "pro"] as const).map((id) => {
              const p = PLANS[id];
              const priceId = priceFor(id);
              return (
                <Card key={id} className={id === "pro" ? "ring-2 ring-brand-600" : ""}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    {id === "pro" && <Badge color="teal">Most popular</Badge>}
                  </div>
                  <p className="mt-2 text-3xl font-extrabold">
                    ${annual ? p.annual : p.monthly}
                    <span className="text-base font-medium text-zinc-500">/{annual ? "year" : "month"}</span>
                  </p>
                  <ul className="mt-4 space-y-1.5 text-sm text-zinc-700">
                    {p.features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {live && priceId ? (
                      <CheckoutButton priceId={priceId} clientToken={env.paddleClientToken!} env={env.paddleEnv} email={user.email} businessId={b.id} label={`Choose ${p.name}`} variant={id === "pro" ? "primary" : "secondary"} />
                    ) : !env.isProduction ? (
                      <form action={simulateSubscribe}>
                        <input type="hidden" name="plan" value={id} />
                        <Button variant={id === "pro" ? "primary" : "secondary"} className="w-full">
                          Simulate {p.name} (test mode)
                        </Button>
                      </form>
                    ) : (
                      <p className="text-sm text-zinc-500">Contact {env.supportEmail} to subscribe.</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          {live && prices.founding && (
            <Card className="mt-4">
              <h3 className="font-semibold">Founding member: $39/month for life</h3>
              <p className="mt-1 text-sm text-zinc-600">For our first 10 customers, in exchange for a short testimonial. Includes everything in Pro.</p>
              <div className="mt-3 max-w-xs">
                <CheckoutButton priceId={prices.founding} clientToken={env.paddleClientToken!} env={env.paddleEnv} email={user.email} businessId={b.id} label="Claim founding price" variant="secondary" />
              </div>
            </Card>
          )}
        </>
      )}

      {b.plan !== "starter" && (
        <Card className="mt-6">
          <form action={setBranding} className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hide" defaultChecked={b.poweredByHidden} />
              Hide &quot;Instant quotes by {env.appName}&quot; on my widget
            </label>
            <Button variant="secondary">Save</Button>
          </form>
        </Card>
      )}
      <p className="mt-6 text-xs text-zinc-500">Payments are processed by Paddle, our merchant of record, which handles sales tax and invoices. Prices in USD.</p>
    </>
  );
}
