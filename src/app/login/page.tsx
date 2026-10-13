import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/brand";
import { getSession, safeNext } from "@/lib/auth";
import { env } from "@/lib/env";
import { googleSignIn } from "./actions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSession()) redirect(next);
  return (
    <AuthShell title="Sign in or create your account">
      {sp.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.error === "expired" ? "That link expired or was already used. Request a new one." : "Sign-in failed. Please try again."}</p>}
      <LoginForm next={next} devOutbox={!env.resendKey && !env.isProduction} />
      {env.googleOAuthClientId && (
        <form action={googleSignIn} className="mt-4">
          <input type="hidden" name="next" value={next} />
          <div className="my-4 flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" />
            or
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
            </svg>
            Continue with Google
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-xs text-zinc-500">
        By continuing you agree to our <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy Policy</a>.
      </p>
    </AuthShell>
  );
}
