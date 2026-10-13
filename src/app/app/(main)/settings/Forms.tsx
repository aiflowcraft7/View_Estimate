"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { saveAlerts, saveArea, saveProfile, type SettingsState } from "./actions";

const TIMEZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

function Status({ s }: { s: SettingsState }) {
  if (s.error) return <Notice tone="error">{s.error}</Notice>;
  if (s.ok) return <p className="text-sm text-emerald-700">{s.ok}</p>;
  return null;
}

type B = {
  name: string;
  phone: string | null;
  website: string | null;
  headline: string | null;
  timezone: string;
  brandColor: string;
  logoUrl: string | null;
  alertEmail: string | null;
  alertPhone: string | null;
  smsAlertsEnabled: boolean;
  zips: string;
  centerLabel: string;
  radiusMiles: number;
};

export function ProfileForm({ b }: { b: B }) {
  const [s, action, pending] = useActionState(saveProfile, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <Input name="name" defaultValue={b.name} required />
        </Field>
        <Field label="Phone shown to homeowners">
          <Input name="phone" defaultValue={b.phone ?? ""} />
        </Field>
        <Field label="Website">
          <Input name="website" defaultValue={b.website ?? ""} />
        </Field>
        <Field label="Time zone">
          <Select name="timezone" defaultValue={b.timezone}>
            {TIMEZONES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Headline on your quote page" hint="Example: Instant prices for house and roof washing in Tampa Bay">
        <Input name="headline" defaultValue={b.headline ?? ""} maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand color">
          <input type="color" name="brandColor" defaultValue={b.brandColor} className="mt-1 h-10 w-20 cursor-pointer rounded" />
        </Field>
        <Field label="Logo" hint="PNG, JPG, WEBP or SVG, under 2 MB. Square works best.">
          <div className="mt-1 flex items-center gap-3">
            {b.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logoUrl} alt="" className="h-10 w-10 rounded object-contain ring-1 ring-zinc-200" />
            )}
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="text-sm" />
          </div>
          {b.logoUrl && (
            <label className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
              <input type="checkbox" name="removeLogo" /> Remove logo
            </label>
          )}
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Status s={s} />
      </div>
    </form>
  );
}

export function AlertsForm({ b, smsLive }: { b: B; smsLive: boolean }) {
  const [s, action, pending] = useActionState(saveAlerts, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Alert email">
          <Input name="alertEmail" type="email" defaultValue={b.alertEmail ?? ""} required />
        </Field>
        <Field label="Alert mobile number" hint={smsLive ? "US numbers only." : "Text alerts start once SMS is connected for your account."}>
          <Input name="alertPhone" type="tel" defaultValue={b.alertPhone ?? ""} />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="smsAlertsEnabled" defaultChecked={b.smsAlertsEnabled} className="mt-0.5" />
        <span>Text me new leads. I agree to receive lead alerts at this number. Reply STOP to opt out.</span>
      </label>
      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Status s={s} />
      </div>
    </form>
  );
}

export function AreaForm({ b }: { b: B }) {
  const [s, action, pending] = useActionState(saveArea, {});
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-zinc-600">Homeowners outside your area can still send a request, but they don&apos;t see a price. Leave everything empty to serve everywhere.</p>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Center city or address">
          <Input name="centerText" defaultValue={b.centerLabel} placeholder="Tampa, FL" />
        </Field>
        <Field label="Radius (miles)">
          <Input name="radiusMiles" type="number" min={0} max={200} defaultValue={b.radiusMiles || ""} />
        </Field>
      </div>
      <Field label="ZIP codes" hint="Separate with commas, spaces or new lines.">
        <Textarea name="zips" rows={3} defaultValue={b.zips} />
      </Field>
      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Status s={s} />
      </div>
    </form>
  );
}
