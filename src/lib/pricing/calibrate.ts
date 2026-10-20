import { priceQuote } from "./engine";
import type { PricingConfig, PropertyFacts, ServiceConfig, ServiceSelection } from "./types";

/** A typical 2-story, 2,000 sq ft vinyl home used to calibrate every service. */
export const SAMPLE_HOME: PropertyFacts = {
  footprintSqft: 1000,
  livingSqft: 2000,
  roofSqft: 1400,
  perimeterFt: 170,
  roofPitchDegrees: 22,
  stories: 2,
  source: "solar",
  siding: "vinyl",
};

export function sampleSelection(svc: ServiceConfig): ServiceSelection {
  if (svc.unit === "flat_sqft") {
    const opt = svc.sizeOptions?.[Math.min(1, (svc.sizeOptions?.length ?? 1) - 1)];
    return { serviceId: svc.id, sizeOptionId: opt?.id };
  }
  if (svc.unit === "window") return { serviceId: svc.id, quantity: 15 };
  return { serviceId: svc.id };
}

export function sampleJobLabel(svc: ServiceConfig): string {
  if (svc.unit === "flat_sqft") {
    const opt = svc.sizeOptions?.[Math.min(1, (svc.sizeOptions?.length ?? 1) - 1)];
    return opt?.label ?? "A typical area";
  }
  if (svc.unit === "window") return "2-story home, 15 windows";
  if (svc.unit === "roof_sqft") return "Typical roof on a 2-story home";
  if (svc.unit === "gutter_lf") return "Gutters on a 2-story, 2,000 sq ft home";
  if (svc.unit === "flat") return "One flat-price job";
  return "2-story home, about 2,000 sq ft, vinyl siding";
}

/** Price of one service on the sample home, ignoring bundles and the order minimum. */
export function samplePrice(svc: ServiceConfig): number {
  const config: PricingConfig = { services: [svc], rules: { roundTo: 1, displayMode: "exact" } };
  return priceQuote(config, SAMPLE_HOME, [sampleSelection(svc)]).total;
}

function roundRate(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Scales a service so the sample job lands on `target`.
 * Rate, minimum, add-on and band prices all move by the same factor.
 */
export function scaleService(svc: ServiceConfig, target: number): ServiceConfig {
  const current = samplePrice(svc);
  if (!(current > 0) || !(target > 0) || target === current) return svc;
  const scale = target / current;
  return {
    ...svc,
    rate: roundRate(svc.rate * scale),
    minPrice: svc.minPrice != null ? Math.max(0, Math.round(svc.minPrice * scale)) : undefined,
    addons: svc.addons?.map((a) => ({ ...a, price: Math.round(a.price * scale * 100) / 100 })),
    bands: svc.bands?.map((b) => ({ ...b, price: Math.round(b.price * scale) })),
  };
}
