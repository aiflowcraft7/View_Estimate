"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Input, Notice } from "@/components/ui";
import { sampleJobLabel, samplePrice, scaleService } from "@/lib/pricing/calibrate";
import type { PricingConfig } from "@/lib/pricing/types";
import { savePricing } from "./actions";

export function Calibrate({ initial, slug }: { initial: PricingConfig; slug: string }) {
  const baseline = useRef(initial);
  const [cfg, setCfg] = useState(initial);
  const [targets, setTargets] = useState<Record<string, number>>(() => Object.fromEntries(initial.services.map((s) => [s.id, samplePrice(s)])));
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const services = cfg.services.filter((s) => s.active !== false);

  function setTarget(id: string, dollars: number) {
    const origin = baseline.current.services.find((s) => s.id === id);
    if (!origin || !(dollars > 0)) return;
    setTargets((t) => ({ ...t, [id]: dollars }));
    setCfg((prev) => ({ ...prev, services: prev.services.map((s) => (s.id === id ? scaleService(origin, dollars) : s)) }));
    setMsg(null);
  }

  function save() {
    start(async () => {
      const r = await savePricing(cfg);
      if (!r.ok) return setMsg({ tone: "error", text: r.error });
      baseline.current = cfg;
      setMsg({ tone: "success", text: "Prices saved. Your quote page is using them now." });
    });
  }

  return (
    <div className="space-y-4">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <p className="text-sm text-zinc-600">
        Drag a sample job to what you would actually charge. The whole service — rate, minimum and add-ons — scales with it.{" "}
        <a className="font-medium text-brand-700 underline" href="/app/pricing?view=advanced">
          Advanced rates
        </a>
      </p>
      {services.map((s) => {
        const shown = targets[s.id] ?? samplePrice(s);
        const originPrice = samplePrice(baseline.current.services.find((b) => b.id === s.id) ?? s);
        const floor = Math.max(49, Math.round(originPrice * 0.4));
        const ceil = Math.max(floor + 50, Math.round(originPrice * 2.5));
        return (
          <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold">{s.name}</h2>
                <p className="text-sm text-zinc-500">{sampleJobLabel(s)}</p>
              </div>
              <label className="text-sm font-medium text-zinc-500">
                You&apos;d charge
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={shown}
                  aria-label={`${s.name} sample price`}
                  onChange={(e) => setTarget(s.id, Math.round(Number(e.target.value) || 0))}
                  className="mt-1 w-28 text-lg font-bold"
                />
              </label>
            </div>
            <input
              type="range"
              className="mt-4 w-full accent-brand-700"
              min={floor}
              max={ceil}
              step={1}
              value={Math.min(ceil, Math.max(floor, shown))}
              aria-label={`${s.name} price slider`}
              onChange={(e) => setTarget(s.id, Number(e.target.value))}
            />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save prices"}
        </Button>
        <a className="text-sm font-medium text-brand-700 underline" href={`/q/${slug}`} target="_blank" rel="noreferrer">
          Open my quote page
        </a>
      </div>
    </div>
  );
}
