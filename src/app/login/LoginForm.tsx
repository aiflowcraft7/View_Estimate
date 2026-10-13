"use client";

import { useActionState } from "react";
import { Button, Input, Label, Notice } from "@/components/ui";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm({ next, devOutbox }: { next: string; devOutbox: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLoginLink, {});
  if (state.sent) {
    return (
      <div className="space-y-3 text-sm">
        <Notice tone="success">
          We sent a sign-in link to <b>{state.sent}</b>. It expires in 20 minutes.
        </Notice>
        {devOutbox && (
          <p className="text-zinc-600">
            Email isn&apos;t connected yet, so open the{" "}
            <a href="/dev/outbox" className="font-semibold text-brand-700 underline">
              dev outbox
            </a>{" "}
            to click the link.
          </p>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
