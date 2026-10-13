"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { priceQuote } from "@/lib/pricing/engine";
import { HOME_SIZE_BANDS } from "@/lib/pricing/templates";
import type { PricingConfig, PropertyFacts, QuoteResult, ServiceConfig, ServiceSelection, SizeSource } from "@/lib/pricing/types";
import { buildPropertyFacts } from "@/lib/property/facts";
import { ServiceIcon } from "./icons";

export type QuoteFlowConfig = {
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  phone: string | null;
  headline: string | null;
  mode: "full" | "requests_only";
  poweredByHidden: boolean;
  pricing: PricingConfig;
};

type Suggestion = { placeId: string; main: string; secondary: string; text: string };
type Measured = {
  placeId: string;
  address: string;
  zip: string | null;
  footprintSqft: number | null;
  roofSqft: number | null;
  perimeterFt: number | null;
  roofPitchDegrees: number | null;
  source: "solar" | "none";
};
type Step = "address" | "size" | "services" | "price" | "form" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "address", label: "Address" },
  { id: "size", label: "Home" },
  { id: "services", label: "Services" },
  { id: "price", label: "Price" },
  { id: "form", label: "Book" },
];

const TIME_WINDOWS = ["Any time", "Weekday morning", "Weekday afternoon", "Saturday", "As soon as possible"];

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
}

function priceLabel(r: QuoteResult): string {
  return r.displayMode === "range" && r.range ? `${money(r.range.low)} – ${money(r.range.high)}` : money(r.total);
}

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

export function QuoteFlow({
  config,
  channel,
  turnstileSiteKey,
  embedded,
  consentText,
  appName,
  preview = false,
}: {
  config: QuoteFlowConfig;
  channel: "widget" | "hosted" | "qr" | "preview";
  turnstileSiteKey?: string | null;
  embedded?: boolean;
  consentText: string;
  appName: string;
  preview?: boolean;
}) {
  const api = `/api/public/${config.slug}`;
  const sessionId = useMemo(uid, []);
  const [placesToken, setPlacesToken] = useState(uid);
  const rootRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("address");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Address
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [manualAddress, setManualAddress] = useState(false);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [address, setAddress] = useState("");
  const [inArea, setInArea] = useState(true);

  // Size
  const [stories, setStories] = useState(1);
  const [sizeSource, setSizeSource] = useState<SizeSource>("none");
  const [livingSqft, setLivingSqft] = useState<number | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  // Services
  const services = useMemo(() => config.pricing.services.filter((s) => s.active !== false), [config.pricing.services]);
  const [selected, setSelected] = useState<Record<string, ServiceSelection>>({});

  // Server quote
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [showPrice, setShowPrice] = useState(config.mode === "full");

  // Lead form
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferredWindow: TIME_WINDOWS[0], notes: "", website: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  // Report height to the parent page so the iframe resizes to fit.
  useEffect(() => {
    if (!embedded || !rootRef.current) return;
    const send = () => window.parent?.postMessage({ type: "viewestimate:height", slug: config.slug, height: Math.ceil(rootRef.current!.getBoundingClientRect().height) + 4 }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(rootRef.current);
    send();
    return () => ro.disconnect();
  }, [embedded, config.slug]);

  useEffect(() => {
    if (preview) return;
    fetch(`${api}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "view", sessionId, channel }) }).catch(() => {});
  }, [api, sessionId, channel, preview]);

  useEffect(() => {
    if (embedded) window.parent?.postMessage({ type: "viewestimate:step", slug: config.slug, step }, "*");
    rootRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [step, embedded, config.slug]);

  // Address autocomplete (debounced).
  useEffect(() => {
    if (manualAddress || step !== "address") return;
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${api}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: q, sessionToken: placesToken }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Address search is unavailable.");
          return;
        }
        setError(null);
        setSuggestions(json.suggestions ?? []);
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, api, placesToken, manualAddress, step]);

  async function pickSuggestion(s: Suggestion) {
    setBusy(true);
    setError(null);
    setSuggestions([]);
    setQuery(s.text);
    try {
      const res = await fetch(`${api}/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: s.placeId, sessionToken: placesToken, sessionId, channel }),
      });
      const json = await res.json();
      setPlacesToken(uid()); // a Places session ends with the details call
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      if (json.found) {
        setMeasured(json.property);
        setAddress(json.property.address);
        setInArea(json.inArea);
        setSizeSource(json.property.source === "solar" ? "solar" : "none");
        setAdjusting(json.property.source !== "solar");
      } else {
        setMeasured(null);
        setAddress(s.text);
        setInArea(true);
        setSizeSource("none");
        setAdjusting(true);
      }
      setStep("size");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const facts: PropertyFacts = useMemo(
    () =>
      buildPropertyFacts(
        measured ? { footprintSqft: measured.footprintSqft, roofSqft: measured.roofSqft, perimeterFt: measured.perimeterFt, roofPitchDegrees: measured.roofPitchDegrees } : null,
        { stories, livingSqft, source: sizeSource },
      ),
    [measured, stories, livingSqft, sizeSource],
  );
  const estimatedLiving = measured?.footprintSqft ? measured.footprintSqft * stories : null;

  const selections = useMemo(() => Object.values(selected), [selected]);
  const live = useMemo(() => (selections.length ? priceQuote(config.pricing, facts, selections) : null), [config.pricing, facts, selections]);
  const canShowLive = config.mode === "full" && inArea;

  function toggleService(s: ServiceConfig) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[s.id]) delete next[s.id];
      else
        next[s.id] = {
          serviceId: s.id,
          sizeOptionId: s.unit === "flat_sqft" ? s.sizeOptions?.[Math.min(1, (s.sizeOptions?.length ?? 1) - 1)]?.id : undefined,
          quantity: s.unit === "window" ? Math.max(8, Math.round((estimatedLiving ?? livingSqft ?? 2000) / 130)) : undefined,
          addons: [],
        };
      return next;
    });
  }

  function updateSelection(id: string, patch: Partial<ServiceSelection>) {
    setSelected((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }

  function toggleAddon(serviceId: string, addonId: string) {
    setSelected((prev) => {
      const sel = prev[serviceId];
      if (!sel) return prev;
      const has = sel.addons?.some((a) => a.id === addonId);
      return { ...prev, [serviceId]: { ...sel, addons: has ? sel.addons!.filter((a) => a.id !== addonId) : [...(sel.addons ?? []), { id: addonId }] } };
    });
  }

  async function getQuote() {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
        const v = params.get(k);
        if (v) utm[k] = v.slice(0, 200);
      }
      const res = await fetch(`${api}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          channel,
          placeId: measured?.placeId,
          address: address || undefined,
          stories,
          livingSqft: sizeSource === "manual" || sizeSource === "band" ? livingSqft : null,
          sizeSource,
          selections,
          referrer: embedded ? document.referrer || undefined : undefined,
          utm: Object.keys(utm).length ? utm : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not price this request");
      setQuoteId(json.quoteId);
      setShowPrice(json.showPrice);
      setInArea(json.inArea);
      setResult(json.result);
      setStep(json.showPrice ? "price" : "form");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Turnstile (only when configured).
  const renderTurnstile = useCallback(() => {
    if (!turnstileSiteKey || !turnstileRef.current || !window.turnstile) return;
    turnstileRef.current.innerHTML = "";
    window.turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (t: string) => setTurnstileToken(t),
      "expired-callback": () => setTurnstileToken(null),
      appearance: "interaction-only",
    });
  }, [turnstileSiteKey]);

  useEffect(() => {
    if (step !== "form" || !turnstileSiteKey) return;
    if (window.turnstile) return renderTurnstile();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = renderTurnstile;
    document.head.appendChild(s);
  }, [step, turnstileSiteKey, renderTurnstile]);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (preview) {
      setStep("done");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set(
        "data",
        JSON.stringify({
          quoteId,
          name: form.name,
          phone: form.phone,
          email: form.email,
          notes: form.notes || undefined,
          preferredWindow: form.preferredWindow,
          address: address || query || undefined,
          smsConsent,
          turnstileToken: turnstileToken ?? undefined,
          sessionId,
          channel,
          website: form.website || undefined,
        }),
      );
      for (const p of photos) fd.append("photos", p);
      const res = await fetch(`${api}/lead`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not send your request");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      if (window.turnstile) window.turnstile.reset();
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const accent = config.brandColor || "#0f766e";

  return (
    <div ref={rootRef} className="qf mx-auto w-full max-w-xl text-zinc-900" style={{ ["--accent" as string]: accent }}>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
        <header className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
          ) : (
            <div className="accent-bg flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white">{config.name.slice(0, 1)}</div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{config.name}</p>
            <p className="truncate text-sm text-zinc-500">{config.headline || "Get an instant price"}</p>
          </div>
        </header>

        {step !== "done" && (
          <ol className="flex gap-1 px-5 pt-4" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s.id} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= stepIndex ? "accent-bg" : "bg-zinc-200"}`} />
                <span className={`mt-1 block text-[11px] ${i === stepIndex ? "font-semibold text-zinc-800" : "text-zinc-400"}`}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="px-5 pb-5 pt-4">
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {step === "address" && (
            <section>
              <h2 className="text-xl font-bold">What&apos;s your address?</h2>
              <p className="mt-1 text-sm text-zinc-500">We use it to measure your home and price it instantly.</p>
              {!manualAddress ? (
                <div className="relative mt-4">
                  <label htmlFor="ve-address" className="sr-only">
                    Street address
                  </label>
                  <input
                    id="ve-address"
                    autoFocus={!embedded}
                    autoComplete="street-address"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Start typing your street address"
                    className="accent-ring block w-full rounded-xl border-0 px-4 py-3.5 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2"
                    role="combobox"
                    aria-expanded={suggestions.length > 0}
                    aria-controls="ve-suggestions"
                    aria-autocomplete="list"
                  />
                  {busy && <p className="mt-2 text-sm text-zinc-500">Measuring your home…</p>}
                  {suggestions.length > 0 && (
                    <ul id="ve-suggestions" role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-zinc-200">
                      {suggestions.map((s) => (
                        <li key={s.placeId} role="option" aria-selected="false">
                          <button type="button" onClick={() => pickSuggestion(s)} className="block w-full px-4 py-3 text-left hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none">
                            <span className="block text-sm font-medium">{s.main}</span>
                            <span className="block text-xs text-zinc-500">{s.secondary}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" onClick={() => setManualAddress(true)} className="mt-3 text-sm text-zinc-500 underline underline-offset-2">
                    I can&apos;t find my address
                  </button>
                </div>
              ) : (
                <form
                  className="mt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (query.trim().length < 5) return setError("Enter your full address");
                    setError(null);
                    setAddress(query.trim());
                    setMeasured(null);
                    setSizeSource("none");
                    setAdjusting(true);
                    setStep("size");
                  }}
                >
                  <label htmlFor="ve-manual" className="text-sm font-medium">
                    Full address
                  </label>
                  <input
                    id="ve-manual"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="123 Main St, City, ST 12345"
                    className="accent-ring mt-1 block w-full rounded-xl border-0 px-4 py-3 ring-1 ring-inset ring-zinc-300 focus:ring-2"
                  />
                  <PrimaryButton className="mt-4 w-full">Continue</PrimaryButton>
                </form>
              )}
            </section>
          )}

          {step === "size" && (
            <section>
              <h2 className="text-xl font-bold">Tell us about your home</h2>
              <p className="mt-1 truncate text-sm text-zinc-500">{address}</p>
              {!inArea && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
                  We may not serve your area. You can still leave your details and we&apos;ll let you know.
                </div>
              )}

              <fieldset className="mt-5">
                <legend className="text-sm font-medium">How many stories?</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStories(n)}
                      aria-pressed={stories === n}
                      className={`rounded-xl px-3 py-3 text-sm font-semibold ring-1 ring-inset ${stories === n ? "accent-bg text-white ring-transparent" : "ring-zinc-300 hover:bg-zinc-50"}`}
                    >
                      {n === 3 ? "3+" : n} {n === 1 ? "story" : "stories"}
                    </button>
                  ))}
                </div>
              </fieldset>

              {sizeSource === "solar" && !adjusting && estimatedLiving ? (
                <div className="mt-5 rounded-xl bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-600">From satellite imagery, your home is about</p>
                  <p className="mt-1 text-2xl font-bold">{estimatedLiving.toLocaleString()} sq ft</p>
                  <button type="button" onClick={() => setAdjusting(true)} className="accent-text mt-2 text-sm font-medium underline underline-offset-2">
                    Adjust size
                  </button>
                </div>
              ) : (
                <fieldset className="mt-5">
                  <legend className="text-sm font-medium">About how big is your home?</legend>
                  <div className="mt-2 grid gap-2">
                    {HOME_SIZE_BANDS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setLivingSqft(b.sqft);
                          setSizeSource("band");
                        }}
                        aria-pressed={sizeSource === "band" && livingSqft === b.sqft}
                        className={`rounded-xl px-4 py-2.5 text-left text-sm ring-1 ring-inset ${sizeSource === "band" && livingSqft === b.sqft ? "accent-border bg-zinc-50 font-semibold ring-2" : "ring-zinc-300 hover:bg-zinc-50"}`}
                        style={sizeSource === "band" && livingSqft === b.sqft ? { ["--tw-ring-color" as string]: accent } : undefined}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block text-sm text-zinc-600">
                    Or enter it exactly:
                    <span className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={300}
                        max={30000}
                        placeholder="e.g. 2400"
                        value={sizeSource === "manual" && livingSqft ? livingSqft : ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setLivingSqft(v > 0 ? v : null);
                          setSizeSource(v > 0 ? "manual" : measured?.source === "solar" ? "solar" : "none");
                        }}
                        className="accent-ring w-32 rounded-lg border-0 px-3 py-2 ring-1 ring-inset ring-zinc-300 focus:ring-2"
                      />
                      <span>sq ft</span>
                    </span>
                  </label>
                  {measured?.source === "solar" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdjusting(false);
                        setSizeSource("solar");
                        setLivingSqft(null);
                      }}
                      className="mt-2 text-sm text-zinc-500 underline underline-offset-2"
                    >
                      Use the satellite estimate
                    </button>
                  )}
                </fieldset>
              )}

              <NavRow
                onBack={() => setStep("address")}
                onNext={() => {
                  if (sizeSource === "none") return setError("Pick your home size to continue");
                  setError(null);
                  setStep("services");
                }}
                nextLabel="Choose services"
              />
            </section>
          )}

          {step === "services" && (
            <section>
              <h2 className="text-xl font-bold">What do you need cleaned?</h2>
              <p className="mt-1 text-sm text-zinc-500">Pick one or more. Bundles save more.</p>
              <div className="mt-4 grid gap-3">
                {services.map((s) => {
                  const sel = selected[s.id];
                  const line = live?.lines.find((l) => l.serviceId === s.id);
                  return (
                    <div key={s.id} className={`rounded-xl ring-1 ring-inset ${sel ? "ring-2" : "ring-zinc-200"}`} style={sel ? { ["--tw-ring-color" as string]: accent } : undefined}>
                      <button type="button" onClick={() => toggleService(s)} aria-pressed={!!sel} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sel ? "accent-bg text-white" : "bg-zinc-100 text-zinc-600"}`}>
                          <ServiceIcon name={s.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{s.name}</span>
                          {s.description && <span className="block text-xs text-zinc-500">{s.description}</span>}
                        </span>
                        {sel && canShowLive && line ? <span className="text-sm font-semibold">{money(line.total)}</span> : null}
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full ring-1 ${sel ? "accent-bg text-white ring-transparent" : "ring-zinc-300"}`} aria-hidden="true">
                          {sel ? "✓" : ""}
                        </span>
                      </button>
                      {sel && (s.unit === "flat_sqft" || s.unit === "window" || s.addons?.length) ? (
                        <div className="space-y-3 border-t border-zinc-100 px-4 py-3">
                          {s.unit === "flat_sqft" && (
                            <label className="block text-sm">
                              <span className="font-medium">Size</span>
                              <select
                                value={sel.sizeOptionId ?? ""}
                                onChange={(e) => updateSelection(s.id, { sizeOptionId: e.target.value })}
                                className="accent-ring mt-1 block w-full rounded-lg border-0 px-3 py-2 ring-1 ring-inset ring-zinc-300"
                              >
                                {s.sizeOptions?.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {s.unit === "window" && (
                            <label className="block text-sm">
                              <span className="font-medium">Number of windows</span>
                              <input
                                type="number"
                                min={1}
                                max={300}
                                inputMode="numeric"
                                value={sel.quantity ?? ""}
                                onChange={(e) => updateSelection(s.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                                className="accent-ring mt-1 block w-28 rounded-lg border-0 px-3 py-2 ring-1 ring-inset ring-zinc-300"
                              />
                            </label>
                          )}
                          {s.addons?.map((a) => (
                            <label key={a.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={!!sel.addons?.some((x) => x.id === a.id)} onChange={() => toggleAddon(s.id, a.id)} className="h-4 w-4 rounded" style={{ accentColor: accent }} />
                              <span className="flex-1">{a.name}</span>
                              {canShowLive && <span className="text-zinc-500">{a.unit === "flat" ? `+${money(a.price)}` : `+${money(a.price)} each`}</span>}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {canShowLive && live && live.lines.length > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                  <div>
                    <p className="text-xs text-zinc-500">Estimated total</p>
                    <p className="text-lg font-bold">{priceLabel(live)}</p>
                  </div>
                  {live.discount ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">You save {money(live.discount.amount)}</span>
                  ) : live.bundleNudge ? (
                    <span className="max-w-[55%] text-right text-xs font-medium text-emerald-700">{live.bundleNudge.label}</span>
                  ) : null}
                </div>
              )}

              <NavRow
                onBack={() => setStep("size")}
                onNext={() => {
                  if (!selections.length) return setError("Pick at least one service");
                  setError(null);
                  void getQuote();
                }}
                nextLabel={canShowLive ? "See my price" : "Continue"}
                busy={busy}
              />
            </section>
          )}

          {step === "price" && result && (
            <section>
              <p className="text-sm text-zinc-500">Your price</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{priceLabel(result)}</p>
              {result.needsOnsiteConfirmation && <p className="mt-1 text-sm text-amber-700">Part of this job needs a quick look on site to confirm.</p>}
              <ul className="mt-5 divide-y divide-zinc-100 border-y border-zinc-100 text-sm">
                {result.lines.map((l) => (
                  <li key={l.serviceId} className="py-2.5">
                    <div className="flex justify-between gap-4">
                      <span className="font-medium">{l.name}</span>
                      <span>{money(l.total)}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {l.measureLabel}
                      {l.addons.length ? ` · ${l.addons.map((a) => a.name).join(", ")}` : ""}
                    </p>
                  </li>
                ))}
                {result.discount && (
                  <li className="flex justify-between py-2.5 font-medium text-emerald-700">
                    <span>{result.discount.name}</span>
                    <span>−{money(result.discount.amount)}</span>
                  </li>
                )}
              </ul>
              {result.bundleNudge && (
                <button type="button" onClick={() => setStep("services")} className="mt-3 w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  {result.bundleNudge.label}
                </button>
              )}
              <p className="mt-3 text-xs text-zinc-500">Estimate based on your address and answers. The final price is confirmed on site.</p>
              <NavRow onBack={() => setStep("services")} onNext={() => setStep("form")} nextLabel="Request this booking" />
            </section>
          )}

          {step === "form" && (
            <form onSubmit={submitLead}>
              <h2 className="text-xl font-bold">{showPrice ? "Request your booking" : "Get your quote"}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {showPrice
                  ? `${config.name} will contact you to confirm a time. This is a request, not a confirmed booking.`
                  : !inArea
                    ? `Leave your details and ${config.name} will let you know if they can help.`
                    : `Leave your details and ${config.name} will send your price shortly.`}
              </p>
              <div className="mt-4 grid gap-3">
                <TextField label="Full name" autoComplete="name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Mobile phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <TextField label="Email" type="email" autoComplete="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                </div>
                <label className="block text-sm">
                  <span className="font-medium">Best time for the job</span>
                  <select
                    value={form.preferredWindow}
                    onChange={(e) => setForm({ ...form, preferredWindow: e.target.value })}
                    className="accent-ring mt-1 block w-full rounded-lg border-0 px-3 py-2.5 ring-1 ring-inset ring-zinc-300"
                  >
                    {TIME_WINDOWS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Anything we should know?</span> <span className="text-zinc-400">(optional)</span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    maxLength={2000}
                    className="accent-ring mt-1 block w-full rounded-lg border-0 px-3 py-2 ring-1 ring-inset ring-zinc-300"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Photos</span> <span className="text-zinc-400">(optional, up to 5)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []).slice(0, 5);
                      if (files.some((f) => f.size > 8 * 1024 * 1024)) return setError("Each photo must be under 8 MB");
                      setError(null);
                      setPhotos(files);
                    }}
                    className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                  />
                  {photos.length > 0 && <span className="mt-1 block text-xs text-zinc-500">{photos.length} photo(s) selected</span>}
                </label>
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                  </label>
                </div>
                <label className="flex items-start gap-2 text-xs text-zinc-600">
                  <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded" style={{ accentColor: accent }} />
                  <span>{consentText}</span>
                </label>
                {turnstileSiteKey && <div ref={turnstileRef} />}
              </div>
              <NavRow onBack={() => setStep(showPrice ? "price" : "services")} nextLabel={busy ? "Sending…" : "Send request"} busy={busy} submit />
            </form>
          )}

          {step === "done" && (
            <section className="py-6 text-center">
              <div className="accent-bg mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white">✓</div>
              <h2 className="mt-4 text-xl font-bold">Request sent!</h2>
              <p className="mt-2 text-sm text-zinc-600">
                {config.name} will contact you shortly to confirm{showPrice ? " your booking" : " your price"}. We emailed you a summary.
              </p>
              {result && showPrice && <p className="mt-4 text-2xl font-bold">{priceLabel(result)}</p>}
              {config.phone && (
                <p className="mt-4 text-sm">
                  Questions? Call{" "}
                  <a className="accent-text font-semibold" href={`tel:${config.phone}`}>
                    {config.phone}
                  </a>
                </p>
              )}
            </section>
          )}
        </div>
      </div>
      {!config.poweredByHidden && (
        <p className="mt-2 text-center text-[11px] text-zinc-400">
          Instant quotes by{" "}
          <a href="/" target="_blank" rel="noopener" className="underline underline-offset-2">
            {appName}
          </a>
        </p>
      )}
    </div>
  );
}

function PrimaryButton({ className = "", busy, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...p}
      disabled={busy || p.disabled}
      className={`accent-bg accent-ring inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function NavRow({ onBack, onNext, nextLabel, busy, submit }: { onBack?: () => void; onNext?: () => void; nextLabel: string; busy?: boolean; submit?: boolean }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      {onBack && (
        <button type="button" onClick={onBack} className="rounded-xl px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
          Back
        </button>
      )}
      <PrimaryButton type={submit ? "submit" : "button"} onClick={submit ? undefined : onNext} busy={busy} className="flex-1">
        {busy && !submit ? "Working…" : nextLabel}
      </PrimaryButton>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  ...p
}: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input {...p} value={value} onChange={(e) => onChange(e.target.value)} className="accent-ring mt-1 block w-full rounded-lg border-0 px-3 py-2.5 ring-1 ring-inset ring-zinc-300 focus:ring-2" />
    </label>
  );
}
