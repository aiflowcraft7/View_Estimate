"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ICON_OPTIONS, ServiceIcon } from "@/components/quote/icons";
import { Button, Input, Notice, Select } from "@/components/ui";
import { priceQuote } from "@/lib/pricing/engine";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";
import type { Addon, Band, Bundle, PricingConfig, PricingUnit, PropertyFacts, ServiceConfig, ServiceSelection } from "@/lib/pricing/types";
import { savePricing } from "./actions";

const UNITS: { id: PricingUnit; label: string; rateLabel: string; help: string }[] = [
  { id: "house_sqft", label: "Per sq ft of house footprint", rateLabel: "$ per footprint sq ft", help: "Footprint from satellite × rate × story multiplier." },
  { id: "living_sqft", label: "Per sq ft of living area", rateLabel: "$ per living sq ft", help: "Living area (footprint × stories, or what the homeowner enters) × rate." },
  { id: "roof_sqft", label: "Per sq ft of roof", rateLabel: "$ per roof sq ft", help: "Roof surface from satellite × rate × pitch multiplier." },
  { id: "flat_sqft", label: "Per sq ft of flatwork", rateLabel: "$ per sq ft", help: "Homeowner picks a size (driveway, patio). Size × rate." },
  { id: "window", label: "Per window", rateLabel: "$ per window", help: "Homeowner enters a window count. Optional count bands." },
  { id: "gutter_lf", label: "Per linear ft of gutter", rateLabel: "$ per linear ft", help: "Gutter length ≈ house perimeter × gutter factor." },
  { id: "band", label: "Price by home size bands", rateLabel: "", help: "A fixed price for each size band of living area." },
  { id: "flat", label: "Flat price", rateLabel: "Price ($)", help: "One fixed price." },
];
const STORY_UNITS: PricingUnit[] = ["house_sqft", "living_sqft", "roof_sqft", "window", "gutter_lf"];

function newId(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "service";
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}_${i}`;
  return id;
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function optNum(v: string): number | undefined {
  return v.trim() === "" ? undefined : num(v);
}

export function PricingEditor({ initial, slug }: { initial: PricingConfig; slug: string }) {
  const [cfg, setCfg] = useState<PricingConfig>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function update(next: PricingConfig) {
    setCfg(next);
    setDirty(true);
    setMsg(null);
  }
  const updateService = (id: string, patch: Partial<ServiceConfig>) => update({ ...cfg, services: cfg.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  function move(id: string, dir: -1 | 1) {
    const i = cfg.services.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= cfg.services.length) return;
    const list = [...cfg.services];
    [list[i], list[j]] = [list[j], list[i]];
    update({ ...cfg, services: list });
  }

  function addService(templateId: string) {
    const taken = new Set(cfg.services.map((s) => s.id));
    const tpl = SERVICE_TEMPLATES.find((t) => t.id === templateId);
    const svc: ServiceConfig = tpl
      ? { ...structuredClone(tpl), id: newId(tpl.id, taken) }
      : { id: newId("custom_service", taken), name: "New service", unit: "flat", rate: 150, minPrice: 0, icon: "sparkle" };
    update({ ...cfg, services: [...cfg.services, svc] });
    setOpen(svc.id);
  }

  function removeService(id: string) {
    if (!confirm("Delete this service?")) return;
    update({ ...cfg, services: cfg.services.filter((s) => s.id !== id), bundles: cfg.bundles?.map((b) => ({ ...b, serviceIds: b.serviceIds?.filter((x) => x !== id) })) });
  }

  function save() {
    start(async () => {
      const r = await savePricing(cfg);
      if (r.ok) {
        setDirty(false);
        setMsg({ tone: "success", text: "Saved. Your quote page uses these prices now." });
      } else setMsg({ tone: "error", text: r.error });
    });
  }

  const rules = cfg.rules ?? {};
  const setRules = (patch: Partial<NonNullable<PricingConfig["rules"]>>) => update({ ...cfg, rules: { ...rules, ...patch } });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="space-y-3">
          {cfg.services.map((s, i) => (
            <ServiceCard
              key={s.id}
              s={s}
              open={open === s.id}
              onToggle={() => setOpen(open === s.id ? null : s.id)}
              onChange={(p) => updateService(s.id, p)}
              onUp={i > 0 ? () => move(s.id, -1) : undefined}
              onDown={i < cfg.services.length - 1 ? () => move(s.id, 1) : undefined}
              onDelete={() => removeService(s.id)}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white p-4">
            <span className="text-sm font-medium">Add a service:</span>
            {SERVICE_TEMPLATES.filter((t) => !cfg.services.some((s) => s.name === t.name)).map((t) => (
              <button key={t.id} type="button" onClick={() => addService(t.id)} className="rounded-full bg-zinc-100 px-3 py-1 text-sm hover:bg-zinc-200">
                + {t.name}
              </button>
            ))}
            <button type="button" onClick={() => addService("custom")} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 hover:bg-brand-100">
              + Custom service
            </button>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Bundle discounts</h2>
          <p className="text-sm text-zinc-500">The best matching discount applies. Homeowners see a nudge like &quot;Add 1 more service to save 10%&quot;.</p>
          <div className="mt-3 space-y-3">
            {(cfg.bundles ?? []).map((b, i) => (
              <BundleRow
                key={b.id}
                b={b}
                services={cfg.services}
                onChange={(p) => update({ ...cfg, bundles: cfg.bundles!.map((x, j) => (j === i ? { ...x, ...p } : x)) })}
                onDelete={() => update({ ...cfg, bundles: cfg.bundles!.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => update({ ...cfg, bundles: [...(cfg.bundles ?? []), { id: newId("bundle", new Set((cfg.bundles ?? []).map((b) => b.id))), name: "Bundle discount", minServices: 2, type: "pct", value: 10 }] })}
          >
            Add discount
          </Button>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Order rules</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Minimum order ($)</span>
              <Input type="number" min={0} value={rules.orderMinimum ?? ""} onChange={(e) => setRules({ orderMinimum: optNum(e.target.value) })} />
            </label>
            <label className="text-sm">
              <span className="font-medium">Round total to nearest</span>
              <Select value={String(rules.roundTo ?? 0)} onChange={(e) => setRules({ roundTo: num(e.target.value) })}>
                <option value="0">$1</option>
                <option value="5">$5</option>
                <option value="10">$10</option>
                <option value="25">$25</option>
              </Select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Show homeowners</span>
              <Select value={rules.displayMode ?? "exact"} onChange={(e) => setRules({ displayMode: e.target.value as "exact" | "range" })}>
                <option value="exact">An exact price</option>
                <option value="range">A price range</option>
              </Select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Range width (± %)</span>
              <Input type="number" min={0} max={50} value={Math.round((rules.rangePct ?? 0.1) * 100)} onChange={(e) => setRules({ rangePct: num(e.target.value) / 100 })} />
              <span className="text-xs text-zinc-500">Also used for jobs that need on-site confirmation.</span>
            </label>
          </div>
        </section>
      </div>

      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={save} disabled={pending || !dirty} className="flex-1">
            {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
          <a href={`/q/${slug}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50">
            Open page
          </a>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Preview cfg={cfg} />
      </div>
    </div>
  );
}

function ServiceCard({
  s,
  open,
  onToggle,
  onChange,
  onUp,
  onDown,
  onDelete,
}: {
  s: ServiceConfig;
  open: boolean;
  onToggle: () => void;
  onChange: (p: Partial<ServiceConfig>) => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
}) {
  const unit = UNITS.find((u) => u.id === s.unit)!;
  const active = s.active !== false;
  return (
    <div className={`rounded-xl bg-white ring-1 ${open ? "ring-brand-600" : "ring-zinc-200"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-brand-50 text-brand-800" : "bg-zinc-100 text-zinc-400"}`}>
          <ServiceIcon name={s.icon} className="h-5 w-5" />
        </span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className={`block truncate font-semibold ${active ? "" : "text-zinc-400 line-through"}`}>{s.name}</span>
          <span className="block truncate text-xs text-zinc-500">
            {unit.label}
            {s.unit !== "band" ? ` · $${s.rate}` : ""}
            {s.minPrice ? ` · min $${s.minPrice}` : ""}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1 text-zinc-400">
          <button type="button" aria-label="Move up" disabled={!onUp} onClick={onUp} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30">
            ↑
          </button>
          <button type="button" aria-label="Move down" disabled={!onDown} onClick={onDown} className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30">
            ↓
          </button>
          <button type="button" onClick={onToggle} className="rounded px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50">
            {open ? "Close" : "Edit"}
          </button>
        </div>
      </div>
      {open && (
        <div className="space-y-5 border-t border-zinc-100 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Name</span>
              <Input value={s.name} onChange={(e) => onChange({ name: e.target.value })} maxLength={80} />
            </label>
            <label className="text-sm">
              <span className="font-medium">Short description</span>
              <Input value={s.description ?? ""} onChange={(e) => onChange({ description: e.target.value || undefined })} maxLength={200} />
            </label>
            <label className="text-sm">
              <span className="font-medium">How it&apos;s priced</span>
              <Select value={s.unit} onChange={(e) => onChange(defaultsForUnit(s, e.target.value as PricingUnit))}>
                {UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </Select>
              <span className="mt-1 block text-xs text-zinc-500">{unit.help}</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {s.unit !== "band" && (
                <label className="text-sm">
                  <span className="font-medium">{unit.rateLabel}</span>
                  <Input type="number" step="0.01" min={0} value={s.rate} onChange={(e) => onChange({ rate: num(e.target.value) })} />
                </label>
              )}
              <label className="text-sm">
                <span className="font-medium">Minimum ($)</span>
                <Input type="number" min={0} value={s.minPrice ?? ""} onChange={(e) => onChange({ minPrice: optNum(e.target.value) })} />
              </label>
            </div>
          </div>

          {STORY_UNITS.includes(s.unit) && (
            <div>
              <p className="text-sm font-medium">Story multipliers</p>
              <div className="mt-1 grid max-w-sm grid-cols-3 gap-2">
                {["1", "2", "3"].map((k) => (
                  <label key={k} className="text-xs text-zinc-500">
                    {k === "3" ? "3+ stories" : `${k} ${k === "1" ? "story" : "stories"}`}
                    <Input
                      type="number"
                      step="0.05"
                      min={0.1}
                      value={s.storyMultipliers?.[k] ?? 1}
                      onChange={(e) => onChange({ storyMultipliers: { "1": 1, ...s.storyMultipliers, [k]: num(e.target.value) || 1 } })}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {s.unit === "roof_sqft" && (
            <ListEditor
              title="Steep roof surcharge"
              hint="Roofs at or above this pitch use the multiplier. Typical: 30° ×1.15, 40° ×1.3."
              rows={s.pitchSteps ?? []}
              columns={[
                { key: "minDegrees", label: "From pitch (°)", type: "number" },
                { key: "multiplier", label: "Multiplier", type: "number", step: "0.05" },
              ]}
              blank={{ minDegrees: 35, multiplier: 1.2 }}
              onChange={(rows) => onChange({ pitchSteps: rows })}
            />
          )}

          {s.unit === "gutter_lf" && (
            <label className="block max-w-xs text-sm">
              <span className="font-medium">Gutter factor</span>
              <Input type="number" step="0.05" min={0.1} max={5} value={s.gutterFactor ?? 1} onChange={(e) => onChange({ gutterFactor: num(e.target.value) || 1 })} />
              <span className="mt-1 block text-xs text-zinc-500">Share of the house perimeter that has gutters. 0.9 is typical.</span>
            </label>
          )}

          {s.unit === "flat_sqft" && (
            <ListEditor
              title="Size choices shown to homeowners"
              rows={s.sizeOptions ?? []}
              columns={[
                { key: "label", label: "Label", type: "text" },
                { key: "sqft", label: "Sq ft", type: "number" },
              ]}
              blank={{ id: "", label: "Medium (about 500 sq ft)", sqft: 500 }}
              withId
              onChange={(rows) => onChange({ sizeOptions: rows })}
            />
          )}

          {(s.unit === "band" || s.unit === "window") && (
            <ListEditor<Band>
              title={s.unit === "band" ? "Price by home size (living sq ft)" : "Optional: price by window count instead of per window"}
              hint={s.unit === "band" ? "Homes above the top band are shown as \"confirmed on site\"." : "Leave empty to price per window."}
              rows={s.bands ?? []}
              columns={[
                { key: "upTo", label: s.unit === "band" ? "Up to sq ft" : "Up to windows", type: "number" },
                { key: "price", label: "Price ($)", type: "number" },
              ]}
              blank={{ upTo: s.unit === "band" ? 2500 : 20, price: 300 }}
              onChange={(rows) => onChange({ bands: rows.length ? rows : undefined })}
            />
          )}

          <ListEditor<Addon>
            title="Add-ons"
            rows={s.addons ?? []}
            columns={[
              { key: "name", label: "Name", type: "text" },
              { key: "unit", label: "Charged", type: "select", options: [["flat", "Once"], ["per_unit", s.unit === "window" ? "Per window" : "Per unit"]] },
              { key: "price", label: "Price ($)", type: "number", step: "0.01" },
            ]}
            blank={{ id: "", name: "Add-on", unit: "flat", price: 50 }}
            withId
            onChange={(rows) => onChange({ addons: rows })}
          />

          <div>
            <p className="text-sm font-medium">Confirm on site when…</p>
            <p className="text-xs text-zinc-500">These jobs show a price range and are flagged for you to confirm.</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-zinc-500">
                More stories than
                <Input type="number" min={1} max={10} value={s.confirmOnsite?.maxStories ?? ""} onChange={(e) => onChange({ confirmOnsite: { ...s.confirmOnsite, maxStories: optNum(e.target.value) } })} />
              </label>
              <label className="text-xs text-zinc-500">
                Home larger than (sq ft)
                <Input type="number" min={0} value={s.confirmOnsite?.maxLivingSqft ?? ""} onChange={(e) => onChange({ confirmOnsite: { ...s.confirmOnsite, maxLivingSqft: optNum(e.target.value) } })} />
              </label>
              <label className="mt-5 flex items-center gap-2 text-xs text-zinc-600">
                <input type="checkbox" checked={!!s.confirmOnsite?.onManualSize} onChange={(e) => onChange({ confirmOnsite: { ...s.confirmOnsite, onManualSize: e.target.checked || undefined } })} />
                Size typed by homeowner
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={!!s.confirmOnsite?.sidingOnsite?.includes("stucco")}
                  onChange={(e) => onChange({ confirmOnsite: { ...s.confirmOnsite, sidingOnsite: e.target.checked ? ["stucco"] : undefined } })}
                />
                Stucco siding
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input type="checkbox" checked={!!s.confirmOnsite?.onStaining} onChange={(e) => onChange({ confirmOnsite: { ...s.confirmOnsite, onStaining: e.target.checked || undefined } })} />
                Visible staining
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={!!s.confirmOnsite?.onNeglectedGutters}
                  onChange={(e) => onChange({ confirmOnsite: { ...s.confirmOnsite, onNeglectedGutters: e.target.checked || undefined } })}
                />
                Gutters not cleaned in years
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => onChange({ active: e.target.checked })} />
                Show on quote page
              </label>
              <label className="flex items-center gap-2 text-sm">
                Icon
                <select value={s.icon ?? "sparkle"} onChange={(e) => onChange({ icon: e.target.value })} className="rounded border-zinc-300 text-sm">
                  {ICON_OPTIONS.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" onClick={onDelete} className="text-sm font-medium text-red-600 hover:underline">
              Delete service
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultsForUnit(s: ServiceConfig, unit: PricingUnit): Partial<ServiceConfig> {
  const patch: Partial<ServiceConfig> = { unit };
  if (unit === "flat_sqft" && !s.sizeOptions?.length)
    patch.sizeOptions = [
      { id: "small", label: "Small (about 300 sq ft)", sqft: 300 },
      { id: "medium", label: "Medium (about 600 sq ft)", sqft: 600 },
      { id: "large", label: "Large (about 1,000 sq ft)", sqft: 1000 },
    ];
  if (unit === "band" && !s.bands?.length)
    patch.bands = [
      { upTo: 1500, price: 249 },
      { upTo: 2500, price: 329 },
      { upTo: 3500, price: 409 },
      { upTo: 5000, price: 529 },
    ];
  if (unit === "gutter_lf" && !s.gutterFactor) patch.gutterFactor = 0.9;
  return patch;
}

type Col = { key: string; label: string; type: "text" | "number" | "select"; step?: string; options?: [string, string][] };

function ListEditor<T extends object>({
  title,
  hint,
  rows,
  columns,
  blank,
  onChange,
  withId,
}: {
  title: string;
  hint?: string;
  rows: T[];
  columns: Col[];
  blank: T;
  onChange: (rows: T[]) => void;
  withId?: boolean;
}) {
  const set = (i: number, key: string, value: string | number) => onChange(rows.map((r, j) => (j === i ? ({ ...r, [key]: value } as T) : r)));
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      {rows.length > 0 && (
        <div className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              {columns.map((c) => {
                const v = (r as Record<string, unknown>)[c.key];
                return (
                  <label key={c.key} className={`text-xs text-zinc-500 ${c.type === "text" ? "min-w-40 flex-1" : "w-28"}`}>
                    {c.label}
                    {c.type === "select" ? (
                      <Select value={String(v)} onChange={(e) => set(i, c.key, e.target.value)}>
                        {c.options!.map(([val, l]) => (
                          <option key={val} value={val}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type={c.type}
                        step={c.step}
                        value={String(v ?? "")}
                        onChange={(e) => set(i, c.key, c.type === "number" ? num(e.target.value) : e.target.value)}
                      />
                    )}
                  </label>
                );
              })}
              <button type="button" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="mb-1.5 rounded px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          const row = { ...blank } as Record<string, unknown>;
          if (withId) {
            const taken = new Set(rows.map((r) => (r as { id?: string }).id));
            row.id = newId(String(row.name ?? row.label ?? "item"), taken as Set<string>);
          }
          onChange([...rows, row as T]);
        }}
        className="mt-2 text-sm font-medium text-brand-700 hover:underline"
      >
        + Add
      </button>
    </div>
  );
}

function BundleRow({ b, services, onChange, onDelete }: { b: Bundle; services: ServiceConfig[]; onChange: (p: Partial<Bundle>) => void; onDelete: () => void }) {
  const mode = b.serviceIds?.length ? "services" : "count";
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-zinc-50 p-3">
      <label className="min-w-40 flex-1 text-xs text-zinc-500">
        Name
        <Input value={b.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label className="w-44 text-xs text-zinc-500">
        Applies when
        <Select value={mode} onChange={(e) => onChange(e.target.value === "count" ? { serviceIds: undefined, minServices: 2 } : { minServices: undefined, serviceIds: services.slice(0, 2).map((s) => s.id) })}>
          <option value="count">Any N services</option>
          <option value="services">Specific services</option>
        </Select>
      </label>
      {mode === "count" ? (
        <label className="w-24 text-xs text-zinc-500">
          N
          <Input type="number" min={2} max={20} value={b.minServices ?? 2} onChange={(e) => onChange({ minServices: Math.max(2, num(e.target.value)) })} />
        </label>
      ) : (
        <div className="w-full text-xs text-zinc-600">
          {services.map((s) => (
            <label key={s.id} className="mr-3 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!b.serviceIds?.includes(s.id)}
                onChange={(e) => onChange({ serviceIds: e.target.checked ? [...(b.serviceIds ?? []), s.id] : b.serviceIds!.filter((x) => x !== s.id) })}
              />
              {s.name}
            </label>
          ))}
        </div>
      )}
      <label className="w-32 text-xs text-zinc-500">
        Discount
        <Select value={b.type} onChange={(e) => onChange({ type: e.target.value as "pct" | "amount" })}>
          <option value="pct">Percent</option>
          <option value="amount">Dollars</option>
        </Select>
      </label>
      <label className="w-24 text-xs text-zinc-500">
        {b.type === "pct" ? "%" : "$"}
        <Input type="number" min={0} value={b.value} onChange={(e) => onChange({ value: num(e.target.value) })} />
      </label>
      <button type="button" onClick={onDelete} aria-label="Remove discount" className="mb-1.5 rounded px-2 py-1 text-zinc-400 hover:text-red-600">
        ✕
      </button>
    </div>
  );
}

type Suggestion = { placeId: string; text: string };

function Preview({ cfg }: { cfg: PricingConfig }) {
  const [p, setP] = useState<PropertyFacts>({ footprintSqft: 1800, roofSqft: 2300, perimeterFt: 190, roofPitchDegrees: 25, stories: 2, source: "solar" });
  const [address, setAddress] = useState("Sample home");
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [token] = useState(() => Math.random().toString(36).slice(2) + Date.now().toString(36));
  const active = cfg.services.filter((s) => s.active !== false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [windows, setWindows] = useState(20);

  useEffect(() => {
    if (q.trim().length < 3) return setSugs([]);
    const t = setTimeout(async () => {
      const r = await fetch("/api/app/places", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: q, sessionToken: token }) });
      if (r.ok) setSugs((await r.json()).suggestions ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, token]);

  async function pick(s: Suggestion) {
    setSugs([]);
    setQ("");
    const r = await fetch("/api/app/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: s.placeId, sessionToken: token }) });
    const j = await r.json();
    setAddress(s.text);
    if (j.found && j.property.source === "solar") {
      setP({ footprintSqft: j.property.footprintSqft, roofSqft: j.property.roofSqft, perimeterFt: j.property.perimeterFt, roofPitchDegrees: j.property.roofPitchAvg, stories: p.stories, source: "solar" });
    } else {
      setAddress(`${s.text} (no satellite data, enter sizes)`);
    }
  }

  const selections: ServiceSelection[] = active
    .filter((s) => picked[s.id] ?? true)
    .map((s) => ({ serviceId: s.id, sizeOptionId: s.sizeOptions?.[Math.min(1, s.sizeOptions.length - 1)]?.id, quantity: s.unit === "window" ? windows : undefined }));
  const r = useMemo(() => (selections.length ? priceQuote(cfg, p, selections) : null), [cfg, p, selections]);
  const field = (k: keyof PropertyFacts, label: string) => (
    <label className="text-xs text-zinc-500">
      {label}
      <Input type="number" value={String(p[k] ?? "")} onChange={(e) => setP({ ...p, [k]: num(e.target.value) || null })} />
    </label>
  );

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <h2 className="font-semibold">Live preview</h2>
      <div className="relative mt-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Test a real address" />
        {sugs.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg bg-white shadow-lg ring-1 ring-zinc-200">
            {sugs.map((s) => (
              <li key={s.placeId}>
                <button type="button" onClick={() => pick(s)} className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50">
                  {s.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 truncate text-xs text-zinc-500">{address}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {field("footprintSqft", "Footprint sq ft")}
        {field("roofSqft", "Roof sq ft")}
        {field("perimeterFt", "Perimeter ft")}
        {field("roofPitchDegrees", "Roof pitch °")}
        <label className="text-xs text-zinc-500">
          Stories
          <Select value={p.stories} onChange={(e) => setP({ ...p, stories: num(e.target.value) })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3+</option>
          </Select>
        </label>
        <label className="text-xs text-zinc-500">
          Windows
          <Input type="number" value={windows} onChange={(e) => setWindows(num(e.target.value))} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {active.map((s) => (
          <label key={s.id} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
            <input type="checkbox" checked={picked[s.id] ?? true} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked })} />
            {s.name}
          </label>
        ))}
      </div>
      {r && (
        <div className="mt-3 border-t border-zinc-100 pt-3 text-sm">
          {r.lines.map((l) => (
            <div key={l.serviceId} className="flex justify-between py-0.5">
              <span className="truncate pr-2">
                {l.name}
                {l.confirmOnsite && <span className="ml-1 text-xs text-amber-600">(confirm)</span>}
              </span>
              <span>${l.total.toLocaleString()}</span>
            </div>
          ))}
          {r.discount && (
            <div className="flex justify-between py-0.5 text-emerald-700">
              <span>{r.discount.name}</span>
              <span>−${r.discount.amount.toLocaleString()}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-base font-bold">
            <span>Homeowner sees</span>
            <span>{r.displayMode === "range" && r.range ? `$${r.range.low.toLocaleString()}–$${r.range.high.toLocaleString()}` : `$${r.total.toLocaleString()}`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
