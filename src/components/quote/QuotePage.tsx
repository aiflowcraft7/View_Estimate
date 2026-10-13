import { notFound } from "next/navigation";
import { smsConsentText } from "@/lib/consent";
import { env } from "@/lib/env";
import { getPublicBusiness, publicConfig } from "@/lib/quotes";
import { QuoteFlow } from "./QuoteFlow";

export async function loadQuotePage(slug: string) {
  const b = await getPublicBusiness(slug);
  if (!b) notFound();
  return b;
}

export async function QuotePage({ slug, channel, embedded }: { slug: string; channel: "widget" | "hosted" | "qr"; embedded: boolean }) {
  const b = await loadQuotePage(slug);
  const cfg = publicConfig(b);
  return (
    <QuoteFlow
      config={cfg}
      channel={channel}
      embedded={embedded}
      turnstileSiteKey={env.turnstileSiteKey ?? null}
      consentText={smsConsentText(b.name)}
      appName={env.appName}
    />
  );
}
