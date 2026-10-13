import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/brand";
import { Button } from "@/components/ui";
import { consumeMagicLink } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

async function verify(form: FormData) {
  "use server";
  const next = await consumeMagicLink(String(form.get("token") ?? ""));
  redirect(next ?? "/login?error=expired");
}

/**
 * The link lands on a confirm button instead of signing in on GET, because
 * email security scanners open links automatically and would burn the token.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/login");
  return (
    <AuthShell title="Finish signing in">
      <form action={verify}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" className="w-full">
          Continue to your account
        </Button>
      </form>
    </AuthShell>
  );
}
