"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";

type Mode = "sign-in" | "sign-up";
type Step = "form" | "verify-email" | "mfa";

function firstError(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;
  const e = errors as { fields?: Record<string, { message?: string } | undefined>; global?: { message?: string }[] };
  for (const field of Object.values(e.fields ?? {})) {
    if (field?.message) return field.message;
  }
  return e.global?.[0]?.message ?? null;
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { signIn, errors: signInErrors, fetchStatus: signInBusy } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpBusy } = useSignUp();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [step, setStep] = useState<Step>("form");
  const [message, setMessage] = useState<string | null>(null);

  const busy = signInBusy === "fetching" || signUpBusy === "fetching";
  const formError = message ?? firstError(mode === "sign-in" ? signInErrors : signUpErrors);

  async function finishSignIn() {
    if (!signIn) return;
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(next);
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
  }

  async function finishSignUp() {
    if (!signUp) return;
    await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(next);
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
  }

  async function onPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    if (mode === "sign-in") {
      if (!signIn) return;
      const { error } = await signIn.password({ emailAddress: email, password });
      if (error) {
        setMessage(error.message ?? "Could not sign in.");
        return;
      }
      if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
        setStep("mfa");
        return;
      }
      if (signIn.status === "complete") await finishSignIn();
      return;
    }

    if (!signUp) return;
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) {
      setMessage(error.message ?? "Could not create your account.");
      return;
    }
    if (signUp.status === "missing_requirements") {
      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) {
        setMessage(sendErr.message ?? "Could not send verification email.");
        return;
      }
      setStep("verify-email");
      return;
    }
    if (signUp.status === "complete") await finishSignUp();
  }

  async function onVerifyEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    if (!signUp) return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setMessage(error.message ?? "Invalid code.");
      return;
    }
    if (signUp.status === "complete") await finishSignUp();
  }

  async function onMfa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    if (!signIn) return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    const { error } = await signIn.mfa.verifyEmailCode({ code });
    if (error) {
      const totp = await signIn.mfa.verifyTOTP({ code });
      if (totp.error) {
        setMessage(totp.error.message ?? "Invalid code.");
        return;
      }
    }
    if (signIn.status === "complete") await finishSignIn();
  }

  async function onGoogle() {
    setMessage(null);
    const redirectCallbackUrl = `${window.location.origin}/login/sso-callback`;
    if (mode === "sign-in" && signIn) {
      const { error } = await signIn.sso({ strategy: "oauth_google", redirectUrl: next, redirectCallbackUrl });
      if (error) setMessage(error.message ?? "Google sign-in failed.");
      return;
    }
    if (signUp) {
      const { error } = await signUp.sso({ strategy: "oauth_google", redirectUrl: next, redirectCallbackUrl });
      if (error) setMessage(error.message ?? "Google sign-up failed.");
    }
  }

  if (step === "verify-email") {
    return (
      <form onSubmit={onVerifyEmail} className="space-y-4">
        <p className="text-sm text-zinc-600">Enter the 6-digit code we emailed you.</p>
        <Field label="Verification code" htmlFor="code">
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </Field>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Verifying…" : "Verify email"}</Button>
        <button type="button" className="text-sm text-brand-700 hover:underline" onClick={() => setStep("form")}>
          Back
        </button>
      </form>
    );
  }

  if (step === "mfa") {
    return (
      <form onSubmit={onMfa} className="space-y-4">
        <p className="text-sm text-zinc-600">Enter the verification code from your email or authenticator app.</p>
        <Field label="Code" htmlFor="code">
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </Field>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Verifying…" : "Continue"}</Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-zinc-100 p-1 text-sm font-semibold">
        <button
          type="button"
          className={`flex-1 rounded-md py-2 ${mode === "sign-in" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}
          onClick={() => {
            setMode("sign-in");
            setMessage(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md py-2 ${mode === "sign-up" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}
          onClick={() => {
            setMode("sign-up");
            setMessage(null);
          }}
        >
          Create account
        </button>
      </div>

      <form onSubmit={onPasswordSubmit} className="space-y-4">
        <Field label="Work email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={8} />
        </Field>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        or
        <span className="h-px flex-1 bg-zinc-200" />
      </div>

      <Button type="button" variant="secondary" disabled={busy} className="w-full" onClick={() => void onGoogle()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
        </svg>
        Continue with Google
      </Button>
    </div>
  );
}
