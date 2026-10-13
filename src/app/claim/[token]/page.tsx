import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/brand";
import { Button, LinkButton } from "@/components/ui";
import { audit, getSession, setActiveBusiness } from "@/lib/auth";
import { claimBusiness, findClaimable } from "@/lib/business";

export const metadata: Metadata = { title: "Claim your quote page", robots: { index: false } };
export const dynamic = "force-dynamic";

async function claim(form: FormData) {
  "use server";
  const token = String(form.get("token") ?? "");
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(`/claim/${token}`)}`);
  const b = await claimBusiness(token, s.user.id, s.user.email);
  if (!b) redirect(`/claim/${token}`);
  await setActiveBusiness(b.id);
  await audit(s.user.id, b.id, "business.claimed");
  redirect("/app?claimed=1");
}

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await findClaimable(token);
  if (!b) {
    return (
      <AuthShell title="This link has already been used">
        <p className="text-sm text-zinc-600">If you already claimed your quote page, sign in to see it.</p>
        <LinkButton href="/login" className="mt-4 w-full">
          Sign in
        </LinkButton>
      </AuthShell>
    );
  }
  const s = await getSession();
  return (
    <AuthShell title={`Your quote page for ${b.name} is ready`}>
      <p className="text-sm text-zinc-600">
        We set up your prices and branding. Claim it to get leads by text and email, adjust prices, and put it on your website. Your 14-day free trial starts today.
      </p>
      <a href={`/q/${b.slug}`} target="_blank" rel="noopener" className="mt-3 block text-sm font-medium text-brand-700 underline">
        Preview your quote page
      </a>
      {s ? (
        <form action={claim} className="mt-5">
          <input type="hidden" name="token" value={token} />
          <Button className="w-full">Claim as {s.user.email}</Button>
        </form>
      ) : (
        <LinkButton href={`/login?next=${encodeURIComponent(`/claim/${token}`)}`} className="mt-5 w-full">
          Sign in to claim
        </LinkButton>
      )}
    </AuthShell>
  );
}
