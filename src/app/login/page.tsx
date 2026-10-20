import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/brand";
import { getSession, safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSession()) redirect(next);
  return (
    <AuthShell title="Sign in or create your account">
      <LoginForm next={next} />
      <p className="mt-6 text-center text-xs text-zinc-500">
        By continuing you agree to our <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy Policy</a>.
      </p>
    </AuthShell>
  );
}
