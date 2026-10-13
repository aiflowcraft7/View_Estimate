"use client";

import { useActionState } from "react";
import { Button, Input, Notice } from "@/components/ui";
import { saveGhl, saveWebhook, sendTest, type IntegrationState } from "./actions";

function Msg({ s }: { s: IntegrationState }) {
  if (s.error) return <Notice tone="error">{s.error}</Notice>;
  if (s.ok) return <Notice tone="success">{s.ok}</Notice>;
  return null;
}

export function UrlForm({ kind, url, placeholder }: { kind: "webhook" | "ghl"; url: string; placeholder: string }) {
  const [s, action, pending] = useActionState(kind === "webhook" ? saveWebhook : saveGhl, {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="url" type="url" required defaultValue={url} placeholder={placeholder} className="mt-0 flex-1" />
        <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
      <Msg s={s} />
    </form>
  );
}

export function TestButton({ kind }: { kind: "webhook" | "ghl" }) {
  const [s, action, pending] = useActionState(sendTest, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="type" value={kind} />
      <Button variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send a test lead"}
      </Button>
      <Msg s={s} />
    </form>
  );
}
