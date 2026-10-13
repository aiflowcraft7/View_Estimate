import { Notice, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { PricingEditor } from "./PricingEditor";

export const metadata = { title: "Services & pricing" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { business: b } = await requireBusiness();
  const { welcome } = await searchParams;
  return (
    <>
      <PageHeader title="Services & pricing" description="Set how each service is priced. The preview updates as you type; homeowners see the new prices once you save." />
      {welcome && (
        <div className="mb-6">
          <Notice tone="success">
            Your quote page is live with starter prices. Adjust them to match what you charge, save, then head to <a className="font-semibold underline" href="/app/install">Install</a>.
          </Notice>
        </div>
      )}
      <PricingEditor initial={b.pricing} slug={b.slug} />
    </>
  );
}
