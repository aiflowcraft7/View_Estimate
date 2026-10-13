import type { Metadata } from "next";
import { QuotePage, loadQuotePage } from "@/components/quote/QuotePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await loadQuotePage(slug);
  const title = `Instant price from ${b.name}`;
  return { title, description: `Type your address and see your price from ${b.name} in seconds.`, openGraph: { title } };
}

export default async function HostedQuotePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> }) {
  const { slug } = await params;
  const { src } = await searchParams;
  return (
    <main className="min-h-dvh bg-zinc-100 px-4 py-6 sm:py-12">
      <QuotePage slug={slug} channel={src === "qr" ? "qr" : "hosted"} embedded={false} />
    </main>
  );
}
