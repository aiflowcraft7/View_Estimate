"use client";

import { useMemo, useState, useTransition } from "react";
import { sampleJobLabel, samplePrice } from "@/lib/pricing/calibrate";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";
import type { PricingConfig } from "@/lib/pricing/types";
import { activateAction, updateBrandAction, updatePricingAction, updateServicesAction } from "./actions";

type Props = {
  slug: string;
  editable: boolean;
  name: string;
  brandColor: string;
  alertEmail: string | null;
  pricing: PricingConfig;
  appUrl: string;
  appName: string;
};

export function ProvisionalClient({ slug, editable, name: initialName, brandColor: initialColor, alertEmail, pricing: initialPricing, appUrl, appName }: Props) {
  const hosted = `${appUrl}/q/${slug}`;
  const embed = `<div id="viewestimate"></div>\n<script src="${appUrl}/w.js" data-business="${slug}" async></script>`;

  const [name, setName] = useState(initialName);
  const [brandColor, setBrandColor] = useState(initialColor);
  const [serviceIds, setServiceIds] = useState(() => initialPricing.services.map((s) => s.id));
  const [pricing, setPricing] = useState(initialPricing);
  const [targets, setTargets] = useState(() => {
    const t: Record<string, number> = {};
    for (const s of initialPricing.services) t[s.id] = samplePrice(s);
    return t;
  });
  const [orderMinimum, setOrderMinimum] = useState(initialPricing.rules?.orderMinimum ?? 199);
  const [email, setEmail] = useState(alertEmail ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const activeServices = useMemo(() => pricing.services.filter((s) => serviceIds.includes(s.id)), [pricing.services, serviceIds]);

  function run(fn: () => Promise<{ error?: string }>, ok = "Saved") {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? ok);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-14 px-4 py-12">
      <div className="text-center">
        <p className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
          Live — ready for customers
        </p>
        <h1 className="mt-4 text-4xl">Here&apos;s your live pricing widget.</h1>
        <p className="mt-3 text-zinc-600">This is exactly what your customers will see. Try it, fine-tune it, then put it everywhere.</p>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] bg-[#efeae3] p-3 sm:p-4">
        <iframe src={`/embed/${slug}`} title={`Live quote form for ${name}`} className="h-[640px] w-full rounded-2xl bg-transparent" />
      </div>

      {editable ? (
        <>
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Lead delivery</p>
            <h2 className="mt-2 text-2xl">Leads go to</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 ring-1 ring-inset ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-700"
                disabled={pending}
              />
              <button
                type="button"
                disabled={pending || !email.trim()}
                onClick={() =>
                  start(async () => {
                    setMsg(null);
                    const r = await activateAction(slug, email);
                    if (r?.error) setMsg(r.error);
                  })
                }
                className="rounded-full bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                Activate
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              Activating creates your free login — your widget and leads live in your dashboard from then on. Your 14-day trial starts when you claim.
            </p>
          </section>

          <section className="space-y-8">
            <h2 className="text-2xl">Fine-tune your widget</h2>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="font-semibold">Your brand</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl px-4 py-2.5 ring-1 ring-inset ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand-700"
                />
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-11 w-16 cursor-pointer rounded" aria-label="Brand color" />
              </div>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-brand-700"
                onClick={() => run(() => updateBrandAction(slug, { name, brandColor }))}
              >
                Save brand
              </button>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="font-semibold">Your services</h3>
              <p className="mt-1 text-sm text-zinc-600">We found these from your answers or site — untick anything you don&apos;t offer.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SERVICE_TEMPLATES.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ${on ? "ring-brand-700" : "ring-zinc-200"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setServiceIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                      />
                      <span className="text-sm font-medium">{s.name}</span>
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-brand-700"
                onClick={() =>
                  run(async () => {
                    const r = await updateServicesAction(slug, serviceIds);
                    if (!r.error) {
                      // Refresh local pricing labels from templates merge — iframe will reload on next nav; keep targets for selected
                      setPricing((p) => ({
                        ...p,
                        services: SERVICE_TEMPLATES.filter((s) => serviceIds.includes(s.id)).map((s) => p.services.find((x) => x.id === s.id) ?? structuredClone(s)),
                      }));
                    }
                    return r;
                  })
                }
              >
                Save services
              </button>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="font-semibold">Adjust your pricing</h3>
              <p className="mt-1 text-sm text-zinc-600">Optional — you can launch as-is. Drag what you&apos;d charge for a sample job.</p>
              <div className="mt-4 space-y-4">
                {activeServices.map((s) => (
                  <label key={s.id} className="block">
                    <span className="flex justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span>${targets[s.id] ?? samplePrice(s)}</span>
                    </span>
                    <span className="text-xs text-zinc-500">{sampleJobLabel(s)}</span>
                    <input
                      type="range"
                      min={99}
                      max={1200}
                      step={5}
                      value={targets[s.id] ?? samplePrice(s)}
                      onChange={(e) => setTargets((t) => ({ ...t, [s.id]: Number(e.target.value) }))}
                      className="mt-2 w-full accent-brand-700"
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="font-medium">Minimum job price</span>
                  <input
                    type="number"
                    min={0}
                    value={orderMinimum}
                    onChange={(e) => setOrderMinimum(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl px-3 py-2 ring-1 ring-inset ring-zinc-300"
                  />
                </label>
              </div>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-brand-700"
                onClick={() => run(() => updatePricingAction(slug, { targets, orderMinimum }))}
              >
                Save pricing
              </button>
            </div>
          </section>
        </>
      ) : (
        <p className="text-center text-sm text-zinc-600">
          This live page was built in another browser. <a href="/build" className="font-medium text-brand-700 underline">Build your own</a>, or ask the owner for their claim link.
        </p>
      )}

      <section>
        <h2 className="text-2xl">Put it everywhere</h2>
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h3 className="font-semibold">Your quote page</h3>
            <p className="mt-1 text-sm text-zinc-600">Link it from Google Business Profile, Facebook, texts — anywhere.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded bg-zinc-100 px-3 py-2 text-sm">{hosted}</code>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-50"
                onClick={() => navigator.clipboard.writeText(hosted)}
              >
                Copy link
              </button>
            </div>
          </div>
          {editable && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="font-semibold">Your QR code</h3>
              <p className="mt-1 text-sm text-zinc-600">Truck door, yard signs, door hangers, invoices.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/p/${slug}/qr?format=png`} alt="QR code for your quote page" className="mt-3 h-36 w-36 rounded ring-1 ring-zinc-200" />
              <a href={`/p/${slug}/qr?format=png`} className="mt-3 inline-block text-sm font-semibold text-brand-700 underline" download>
                Download PNG
              </a>
            </div>
          )}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h3 className="font-semibold">Embed on your site</h3>
            <p className="mt-1 text-sm text-zinc-600">One line of code — Wix, Squarespace, WordPress, GoHighLevel.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-100 p-3 text-xs">{embed}</pre>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-brand-700"
              onClick={() => navigator.clipboard.writeText(embed)}
            >
              Copy snippet
            </button>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">Instant quotes by {appName}</p>
      </section>

      {msg && (
        <p role="status" className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {msg}
        </p>
      )}
    </div>
  );
}
