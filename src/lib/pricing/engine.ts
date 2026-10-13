import type {
  Band,
  Bundle,
  PricingConfig,
  PropertyFacts,
  QuoteLine,
  QuoteResult,
  ServiceConfig,
  ServiceSelection,
} from "./types";

/**
 * The single source of truth for prices. Pure and deterministic: the pricing
 * builder preview, the widget and the server all call this, and the server
 * result is the one that gets stored on quotes and leads.
 */
export function priceQuote(config: PricingConfig, property: PropertyFacts, selections: ServiceSelection[]): QuoteResult {
  const errors: string[] = [];
  const rules = config.rules ?? {};
  const services = new Map(config.services.filter((s) => s.active !== false).map((s) => [s.id, s]));

  const seen = new Set<string>();
  const lines: QuoteLine[] = [];
  for (const sel of selections) {
    if (seen.has(sel.serviceId)) continue;
    seen.add(sel.serviceId);
    const svc = services.get(sel.serviceId);
    if (!svc) {
      errors.push(`Unknown service: ${sel.serviceId}`);
      continue;
    }
    lines.push(priceLine(svc, property, sel));
  }

  const subtotal = money(lines.reduce((s, l) => s + l.total, 0));
  const selectedIds = lines.map((l) => l.serviceId);
  const discount = bestBundle(config.bundles ?? [], selectedIds, subtotal);

  let total = subtotal - (discount?.amount ?? 0);
  let orderMinimumApplied = false;
  if (lines.length > 0 && rules.orderMinimum && total < rules.orderMinimum) {
    total = rules.orderMinimum;
    orderMinimumApplied = true;
  }
  total = roundTo(total, rules.roundTo);

  const needsOnsiteConfirmation = lines.some((l) => l.confirmOnsite);
  const displayMode: "exact" | "range" = rules.displayMode === "range" || needsOnsiteConfirmation ? "range" : "exact";
  const pct = rules.rangePct ?? 0.15;
  const range =
    displayMode === "range" && lines.length > 0
      ? { low: roundTo(total * (1 - pct), rules.roundTo), high: roundTo(total * (1 + pct), rules.roundTo) }
      : null;

  return {
    lines,
    subtotal,
    discount,
    orderMinimumApplied,
    total: lines.length ? total : 0,
    displayMode,
    range,
    needsOnsiteConfirmation,
    bundleNudge: bundleNudge(config.bundles ?? [], selectedIds, services.size),
    errors,
  };
}

export function livingSqft(p: PropertyFacts): number | null {
  if (p.livingSqft && p.livingSqft > 0) return p.livingSqft;
  if (p.footprintSqft && p.footprintSqft > 0) return p.footprintSqft * Math.max(1, p.stories);
  return null;
}

function storyMultiplier(svc: ServiceConfig, stories: number): number {
  const m = svc.storyMultipliers;
  if (!m) return 1;
  const s = Math.max(1, Math.round(stories));
  if (m[String(s)] != null) return m[String(s)];
  // Use the highest defined story count at or below s.
  const keys = Object.keys(m).map(Number).filter((k) => k <= s).sort((a, b) => b - a);
  return keys.length ? m[String(keys[0])] : 1;
}

function pitchMultiplier(svc: ServiceConfig, degrees: number | null | undefined): number {
  if (!svc.pitchSteps?.length || degrees == null) return 1;
  const step = [...svc.pitchSteps].sort((a, b) => b.minDegrees - a.minDegrees).find((s) => degrees >= s.minDegrees);
  return step?.multiplier ?? 1;
}

function bandPrice(bands: Band[], measure: number): number | null {
  const sorted = [...bands].sort((a, b) => a.upTo - b.upTo);
  const band = sorted.find((b) => measure <= b.upTo);
  return band ? band.price : null;
}

function priceLine(svc: ServiceConfig, p: PropertyFacts, sel: ServiceSelection): QuoteLine {
  const notes: string[] = [];
  let measure = 0;
  let measureLabel = "";
  let base = 0;
  let confirmOnsite = false;
  let sizeMissing = false;
  const stories = Math.max(1, Math.round(p.stories || 1));

  switch (svc.unit) {
    case "house_sqft": {
      const fp = p.footprintSqft ?? (p.livingSqft ? p.livingSqft / stories : null);
      if (!fp) sizeMissing = true;
      measure = Math.round(fp ?? 0);
      measureLabel = `${fmt(measure)} sq ft footprint, ${stories} ${stories === 1 ? "story" : "stories"}`;
      base = measure * svc.rate * storyMultiplier(svc, stories);
      break;
    }
    case "living_sqft": {
      const l = livingSqft(p);
      if (!l) sizeMissing = true;
      measure = Math.round(l ?? 0);
      measureLabel = `${fmt(measure)} sq ft home`;
      base = measure * svc.rate * storyMultiplier(svc, stories);
      break;
    }
    case "roof_sqft": {
      if (!p.roofSqft) sizeMissing = true;
      measure = Math.round(p.roofSqft ?? 0);
      const pm = pitchMultiplier(svc, p.roofPitchDegrees);
      measureLabel = `${fmt(measure)} sq ft roof` + (pm !== 1 ? ` (steep roof x${pm})` : "");
      base = measure * svc.rate * pm * storyMultiplier(svc, stories);
      break;
    }
    case "flat_sqft": {
      const opt = svc.sizeOptions?.find((o) => o.id === sel.sizeOptionId);
      const sq = opt?.sqft ?? sel.quantity ?? 0;
      if (!sq) sizeMissing = true;
      measure = Math.round(sq);
      measureLabel = opt ? opt.label : `${fmt(measure)} sq ft`;
      base = measure * svc.rate;
      break;
    }
    case "window": {
      const count = Math.max(0, Math.round(sel.quantity ?? 0));
      if (!count) sizeMissing = true;
      measure = count;
      measureLabel = `${count} window${count === 1 ? "" : "s"}`;
      if (svc.bands?.length) {
        const bp = bandPrice(svc.bands, count);
        if (bp == null) {
          confirmOnsite = true;
          notes.push("More windows than the largest price band");
          base = Math.max(...svc.bands.map((b) => b.price));
        } else base = bp;
      } else base = count * svc.rate;
      base *= storyMultiplier(svc, stories);
      break;
    }
    case "gutter_lf": {
      if (!p.perimeterFt) sizeMissing = true;
      measure = Math.round((p.perimeterFt ?? 0) * (svc.gutterFactor ?? 1));
      measureLabel = `${fmt(measure)} ft of gutter`;
      base = measure * svc.rate * storyMultiplier(svc, stories);
      break;
    }
    case "flat": {
      measure = 1;
      measureLabel = "Flat price";
      base = svc.rate;
      break;
    }
    case "band": {
      const l = livingSqft(p);
      if (!l) sizeMissing = true;
      measure = Math.round(l ?? 0);
      measureLabel = `${fmt(measure)} sq ft home`;
      const bp = svc.bands?.length ? bandPrice(svc.bands, measure) : null;
      if (bp == null) {
        confirmOnsite = true;
        notes.push("Home is larger than the largest price band");
        base = svc.bands?.length ? Math.max(...svc.bands.map((b) => b.price)) : 0;
      } else base = bp;
      break;
    }
  }

  if (sizeMissing) {
    confirmOnsite = true;
    notes.push("Size needed to price this exactly");
  }

  const addons: QuoteLine["addons"] = [];
  for (const a of sel.addons ?? []) {
    const def = svc.addons?.find((x) => x.id === a.id);
    if (!def) continue;
    const qty = def.unit === "per_unit" ? (a.quantity ?? measure) : 1;
    addons.push({ id: def.id, name: def.name, amount: money(def.price * qty) });
  }

  const rules = svc.confirmOnsite ?? {};
  const living = livingSqft(p);
  if (rules.maxStories != null && stories > rules.maxStories) {
    confirmOnsite = true;
    notes.push(`Homes over ${rules.maxStories} ${rules.maxStories === 1 ? "story" : "stories"} are confirmed on site`);
  }
  if (rules.maxLivingSqft != null && living != null && living > rules.maxLivingSqft) {
    confirmOnsite = true;
    notes.push(`Homes over ${fmt(rules.maxLivingSqft)} sq ft are confirmed on site`);
  }
  if (rules.onManualSize && p.source === "manual") {
    confirmOnsite = true;
    notes.push("Size entered by hand, confirmed on site");
  }

  const raw = base + addons.reduce((s, a) => s + a.amount, 0);
  const minimumApplied = !!svc.minPrice && raw < svc.minPrice;
  // Homeowners see whole dollars per line.
  const total = Math.round(minimumApplied ? svc.minPrice! : raw);

  return {
    serviceId: svc.id,
    name: svc.name,
    unit: svc.unit,
    measure,
    measureLabel,
    base: money(base),
    addons,
    minimumApplied,
    total,
    confirmOnsite,
    notes,
  };
}

function bundleApplies(b: Bundle, selected: string[]): boolean {
  if (b.serviceIds?.length && !b.serviceIds.every((id) => selected.includes(id))) return false;
  if (b.minServices && selected.length < b.minServices) return false;
  return !!(b.serviceIds?.length || b.minServices);
}

function bestBundle(bundles: Bundle[], selected: string[], subtotal: number): QuoteResult["discount"] {
  let best: QuoteResult["discount"] = null;
  for (const b of bundles) {
    if (!bundleApplies(b, selected)) continue;
    const amount = Math.round(Math.min(subtotal, b.type === "pct" ? (subtotal * b.value) / 100 : b.value));
    if (!best || amount > best.amount) best = { bundleId: b.id, name: b.name, amount };
  }
  return best;
}

function bundleNudge(bundles: Bundle[], selected: string[], available: number): QuoteResult["bundleNudge"] {
  if (selected.length === 0) return null;
  let best: QuoteResult["bundleNudge"] = null;
  for (const b of bundles) {
    if (!b.minServices || b.serviceIds?.length || bundleApplies(b, selected)) continue;
    const need = b.minServices - selected.length;
    if (need <= 0 || selected.length + need > available) continue;
    const save = b.type === "pct" ? `${b.value}%` : `$${b.value}`;
    const label = `Add ${need} more service${need === 1 ? "" : "s"} to save ${save}`;
    if (!best || need < best.servicesNeeded) best = { name: b.name, servicesNeeded: need, label };
  }
  return best;
}

export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundTo(n: number, step?: number): number {
  const s = step && step > 0 ? step : 1;
  return Math.round(n / s) * s;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
