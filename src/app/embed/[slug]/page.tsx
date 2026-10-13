import type { Metadata } from "next";
import { QuotePage } from "@/components/quote/QuotePage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="embed-root p-1">
      <QuotePage slug={slug} channel="widget" embedded />
    </main>
  );
}
