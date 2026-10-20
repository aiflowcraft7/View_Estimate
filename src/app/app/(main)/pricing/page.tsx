import { LinkButton, Notice, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { Calibrate } from "./Calibrate";
import { PricingEditor } from "./PricingEditor";

export const metadata = { title: "Services & pricing" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ welcome?: string; view?: string }> }) {
  const { business: b } = await requireBusiness();
  const { welcome, view } = await searchParams;
  const advanced = view === "advanced";
  return (
    <>
      <PageHeader
        title={advanced ? "Advanced rates" : "Calibrate prices"}
        description={advanced ? "Units, add-ons, bundles and rounding. Homeowners see the new prices once you save." : "Match a sample job to what you charge. Your quote page is already live."}
        actions={
          advanced ? (
            <LinkButton href="/app/pricing" variant="secondary">
              Back to calibrate
            </LinkButton>
          ) : (
            <LinkButton href="/app/pricing?view=advanced" variant="secondary">
              Advanced rates
            </LinkButton>
          )
        }
      />
      {welcome && !advanced && (
        <div className="mb-6">
          <Notice tone="success">
            Your quote page is live. Set these sample prices, save, then share it from <a className="font-semibold underline" href="/app/install">Install</a>.
          </Notice>
        </div>
      )}
      {advanced ? <PricingEditor initial={b.pricing} slug={b.slug} /> : <Calibrate initial={b.pricing} slug={b.slug} />}
    </>
  );
}
