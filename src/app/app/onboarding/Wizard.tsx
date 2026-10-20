"use client";

import { useState, useTransition } from "react";
import { ServiceIcon } from "@/components/quote/icons";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";
import { createBusinessAction, type OnboardingInput } from "./actions";

const TIMEZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
];
const COLORS = ["#0f766e", "#0e7490", "#1d4ed8", "#4338ca", "#15803d", "#b45309", "#be123c", "#18181b"];
const STEPS = ["Your business", "Services", "Your area"];

export function Wizard({ email }: { email: string }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [d, setD] = useState<OnboardingInput>({
    name: "",
    phone: "",
    website: "",
    alertEmail: email,
    alertPhone: "",
    smsAlerts: false,
    brandColor: COLORS[0],
    serviceIds: ["house_wash", "roof_wash", "driveway"],
    zips: "",
    centerText: "",
    radiusMiles: 25,
    timezone: "America/New_York",
  });
  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) => setD((p) => ({ ...p, [k]: v }));

  function next() {
    setError(null);
    if (step === 0 && d.name.trim().length < 2) return setError("Enter your business name");
    if (step === 1 && !d.serviceIds.length) return setError("Pick at least one service");
    if (step === 2 && (d.centerText ?? "").trim().length < 3) return setError("Enter the city you work in");
    if (step === 2 && !(d.radiusMiles && d.radiusMiles > 0)) return setError("Enter how many miles you travel");
    if (step < STEPS.length - 1) return setStep(step + 1);
    start(async () => {
      const r = await createBusinessAction(d);
      if (r && "error" in r) setError(r.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <ol className="mb-6 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand-700" : "bg-zinc-200"}`} />
            <span className={`mt-1 block text-xs ${i === step ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{s}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Tell us about your business</h2>
            <Field label="Business name" htmlFor="name">
              <Input id="name" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Sunshine Soft Wash" autoFocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business phone" htmlFor="phone" hint="Shown to homeowners">
                <Input id="phone" type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(813) 555-0142" />
              </Field>
              <Field label="Website" htmlFor="website">
                <Input id="website" value={d.website} onChange={(e) => set("website", e.target.value)} placeholder="sunshinesoftwash.com" />
              </Field>
            </div>
            <Field label="Brand color">
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("brandColor", c)}
                    aria-label={`Color ${c}`}
                    aria-pressed={d.brandColor === c}
                    className={`h-8 w-8 rounded-full ring-offset-2 ${d.brandColor === c ? "ring-2 ring-zinc-900" : ""}`}
                    style={{ background: c }}
                  />
                ))}
                <input type="color" value={d.brandColor} onChange={(e) => set("brandColor", e.target.value)} className="h-8 w-10 cursor-pointer rounded" aria-label="Custom color" />
              </div>
            </Field>
            <p className="text-sm text-zinc-500">Lead alerts go to {email}. You can add a text number later in Settings.</p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold">Which services do you offer?</h2>
            <p className="mt-1 text-sm text-zinc-600">We start you with typical prices. You can change every number next.</p>
            <div className="mt-4 grid gap-2">
              {SERVICE_TEMPLATES.map((s) => {
                const on = d.serviceIds.includes(s.id);
                return (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ${on ? "bg-brand-50 ring-brand-600" : "ring-zinc-200 hover:bg-zinc-50"}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => set("serviceIds", on ? d.serviceIds.filter((x) => x !== s.id) : [...d.serviceIds, s.id])}
                    />
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${on ? "bg-brand-700 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                      <ServiceIcon name={s.icon} className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{s.name}</span>
                      <span className="block text-xs text-zinc-500">{s.description}</span>
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded text-xs ${on ? "bg-brand-700 text-white" : "ring-1 ring-zinc-300"}`}>{on ? "✓" : ""}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Where do you work?</h2>
            <p className="text-sm text-zinc-600">Addresses outside this area still become leads, but they don&apos;t see a price. You can add ZIP codes later in Settings.</p>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="City or metro" htmlFor="center">
                <Input id="center" value={d.centerText} onChange={(e) => set("centerText", e.target.value)} placeholder="Tampa, FL" autoFocus />
              </Field>
              <Field label="Radius (miles)" htmlFor="radius">
                <Input id="radius" type="number" min={1} max={200} value={d.radiusMiles ?? ""} onChange={(e) => set("radiusMiles", Number(e.target.value) || 0)} />
              </Field>
            </div>
            <Field label="Time zone">
              <Select value={d.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {TIMEZONES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" type="button" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={next} disabled={pending}>
            {step < STEPS.length - 1 ? "Continue" : pending ? "Creating…" : "Create my quote page"}
          </Button>
        </div>
      </div>
    </div>
  );
}
