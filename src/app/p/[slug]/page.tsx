import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getEditableUnclaimed } from "@/lib/build/claim-cookie";
import { env } from "@/lib/env";
import { getPublicBusiness } from "@/lib/quotes";
import { ProvisionalClient } from "./ProvisionalClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Your page is live — ${slug}`, robots: { index: false } };
}

export default async function ProvisionalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();
  if (b.claimedAt) redirect(`/q/${slug}`);

  const editable = !!(await getEditableUnclaimed(slug));

  return (
    <main>
      <ProvisionalClient
        slug={b.slug}
        editable={editable}
        name={b.name}
        brandColor={b.brandColor}
        alertEmail={b.alertEmail}
        pricing={b.pricing}
        appUrl={env.appUrl}
        appName={env.appName}
      />
    </main>
  );
}
