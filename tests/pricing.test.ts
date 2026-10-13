import { describe, expect, it } from "vitest";
import { livingSqft, priceQuote, roundTo } from "@/lib/pricing/engine";
import { DEFAULT_PRICING, SERVICE_TEMPLATES, templateFor } from "@/lib/pricing/templates";
import { pricingConfigSchema } from "@/lib/pricing/schema";
import type { PricingConfig, PropertyFacts, ServiceConfig } from "@/lib/pricing/types";

const home: PropertyFacts = { footprintSqft: 1500, roofSqft: 2000, perimeterFt: 160, roofPitchDegrees: 22, stories: 2, source: "solar" };

function cfg(services: ServiceConfig[], extra: Partial<PricingConfig> = {}): PricingConfig {
  return { services, ...extra };
}
const svc = (s: Partial<ServiceConfig> & Pick<ServiceConfig, "unit" | "rate">): ServiceConfig => ({ id: "s", name: "Service", ...s });

describe("units", () => {
  it("house_sqft uses footprint x rate x story multiplier", () => {
    const r = priceQuote(cfg([svc({ unit: "house_sqft", rate: 0.2, storyMultipliers: { "1": 1, "2": 1.5 } })]), home, [{ serviceId: "s" }]);
    expect(r.lines[0].base).toBe(450);
    expect(r.total).toBe(450);
  });

  it("living_sqft uses footprint x stories when no living sq ft given", () => {
    const r = priceQuote(cfg([svc({ unit: "living_sqft", rate: 0.1 })]), home, [{ serviceId: "s" }]);
    expect(r.lines[0].measure).toBe(3000);
    expect(r.total).toBe(300);
  });

  it("living_sqft prefers homeowner-typed living sq ft", () => {
    const r = priceQuote(cfg([svc({ unit: "living_sqft", rate: 0.1 })]), { ...home, livingSqft: 2400, source: "manual" }, [{ serviceId: "s" }]);
    expect(r.lines[0].measure).toBe(2400);
    expect(r.total).toBe(240);
  });

  it("roof_sqft applies no pitch multiplier on low pitch", () => {
    const r = priceQuote(cfg([svc({ unit: "roof_sqft", rate: 0.3, pitchSteps: [{ minDegrees: 30, multiplier: 1.2 }] })]), home, [{ serviceId: "s" }]);
    expect(r.lines[0].base).toBe(600);
  });

  it("roof_sqft picks the highest matching pitch step", () => {
    const s = svc({ unit: "roof_sqft", rate: 0.3, pitchSteps: [{ minDegrees: 30, multiplier: 1.2 }, { minDegrees: 40, multiplier: 1.5 }] });
    expect(priceQuote(cfg([s]), { ...home, roofPitchDegrees: 35 }, [{ serviceId: "s" }]).lines[0].base).toBe(720);
    expect(priceQuote(cfg([s]), { ...home, roofPitchDegrees: 45 }, [{ serviceId: "s" }]).lines[0].base).toBe(900);
  });

  it("flat_sqft prices the chosen size option", () => {
    const s = svc({ unit: "flat_sqft", rate: 0.2, sizeOptions: [{ id: "a", label: "Two car", sqft: 600 }] });
    const r = priceQuote(cfg([s]), home, [{ serviceId: "s", sizeOptionId: "a" }]);
    expect(r.lines[0].base).toBe(120);
    expect(r.lines[0].measureLabel).toBe("Two car");
  });

  it("flat_sqft accepts a custom quantity", () => {
    const s = svc({ unit: "flat_sqft", rate: 0.2, sizeOptions: [{ id: "a", label: "x", sqft: 600 }] });
    expect(priceQuote(cfg([s]), home, [{ serviceId: "s", quantity: 1000 }]).lines[0].base).toBe(200);
  });

  it("window prices per window with story multiplier", () => {
    const s = svc({ unit: "window", rate: 8, storyMultipliers: { "1": 1, "2": 1.25 } });
    expect(priceQuote(cfg([s]), home, [{ serviceId: "s", quantity: 20 }]).lines[0].base).toBe(200);
  });

  it("window uses count bands when defined", () => {
    const s = svc({ unit: "window", rate: 0, bands: [{ upTo: 10, price: 150 }, { upTo: 20, price: 250 }] });
    expect(priceQuote(cfg([s]), { ...home, stories: 1 }, [{ serviceId: "s", quantity: 12 }]).lines[0].base).toBe(250);
  });

  it("window above the top band is confirmed on site", () => {
    const s = svc({ unit: "window", rate: 0, bands: [{ upTo: 10, price: 150 }] });
    const r = priceQuote(cfg([s]), { ...home, stories: 1 }, [{ serviceId: "s", quantity: 40 }]);
    expect(r.lines[0].confirmOnsite).toBe(true);
    expect(r.displayMode).toBe("range");
  });

  it("gutter_lf uses perimeter x factor x rate x story multiplier", () => {
    const s = svc({ unit: "gutter_lf", rate: 1, gutterFactor: 0.5, storyMultipliers: { "1": 1, "2": 2 } });
    const r = priceQuote(cfg([s]), home, [{ serviceId: "s" }]);
    expect(r.lines[0].measure).toBe(80);
    expect(r.lines[0].base).toBe(160);
  });

  it("flat unit ignores size", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 99 })]), { stories: 1, source: "none" }, [{ serviceId: "s" }]);
    expect(r.total).toBe(99);
    expect(r.needsOnsiteConfirmation).toBe(false);
  });

  it("band unit picks the first band that fits", () => {
    const s = svc({ unit: "band", rate: 0, bands: [{ upTo: 2000, price: 300 }, { upTo: 3000, price: 400 }, { upTo: 4000, price: 500 }] });
    expect(priceQuote(cfg([s]), { stories: 1, livingSqft: 2000, source: "band" }, [{ serviceId: "s" }]).total).toBe(300);
    expect(priceQuote(cfg([s]), { stories: 1, livingSqft: 2001, source: "band" }, [{ serviceId: "s" }]).total).toBe(400);
  });

  it("band unit above the top band is confirmed on site at the top price", () => {
    const s = svc({ unit: "band", rate: 0, bands: [{ upTo: 2000, price: 300 }] });
    const r = priceQuote(cfg([s]), { stories: 1, livingSqft: 5000, source: "band" }, [{ serviceId: "s" }]);
    expect(r.lines[0].confirmOnsite).toBe(true);
    expect(r.lines[0].base).toBe(300);
  });

  it("bands are sorted before matching", () => {
    const s = svc({ unit: "band", rate: 0, bands: [{ upTo: 4000, price: 500 }, { upTo: 2000, price: 300 }] });
    expect(priceQuote(cfg([s]), { stories: 1, livingSqft: 1500, source: "band" }, [{ serviceId: "s" }]).total).toBe(300);
  });
});

describe("stories", () => {
  it("falls back to the highest defined multiplier at or below the story count", () => {
    const s = svc({ unit: "house_sqft", rate: 0.1, storyMultipliers: { "1": 1, "2": 2 } });
    expect(priceQuote(cfg([s]), { ...home, stories: 3 }, [{ serviceId: "s" }]).lines[0].base).toBe(300);
  });
  it("uses 1 when no multipliers are defined", () => {
    expect(priceQuote(cfg([svc({ unit: "house_sqft", rate: 0.1 })]), home, [{ serviceId: "s" }]).lines[0].base).toBe(150);
  });
  it("treats stories below 1 as 1", () => {
    const r = priceQuote(cfg([svc({ unit: "living_sqft", rate: 0.1 })]), { ...home, stories: 0 }, [{ serviceId: "s" }]);
    expect(r.lines[0].measure).toBe(1500);
  });
});

describe("minimums and add-ons", () => {
  it("applies the service minimum", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 50, minPrice: 149 })]), home, [{ serviceId: "s" }]);
    expect(r.lines[0].minimumApplied).toBe(true);
    expect(r.total).toBe(149);
  });
  it("does not apply the minimum when above it", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 200, minPrice: 149 })]), home, [{ serviceId: "s" }]);
    expect(r.lines[0].minimumApplied).toBe(false);
  });
  it("adds flat add-ons once", () => {
    const s = svc({ unit: "flat", rate: 100, addons: [{ id: "a", name: "Rust", unit: "flat", price: 75 }] });
    expect(priceQuote(cfg([s]), home, [{ serviceId: "s", addons: [{ id: "a", quantity: 5 }] }]).total).toBe(175);
  });
  it("prices per-unit add-ons by the service quantity", () => {
    const s = svc({ unit: "window", rate: 10, addons: [{ id: "scr", name: "Screens", unit: "per_unit", price: 3 }] });
    const r = priceQuote(cfg([s]), { ...home, stories: 1 }, [{ serviceId: "s", quantity: 10, addons: [{ id: "scr" }] }]);
    expect(r.lines[0].addons[0].amount).toBe(30);
    expect(r.total).toBe(130);
  });
  it("per-unit add-ons accept an explicit quantity", () => {
    const s = svc({ unit: "window", rate: 10, addons: [{ id: "scr", name: "Screens", unit: "per_unit", price: 3 }] });
    const r = priceQuote(cfg([s]), { ...home, stories: 1 }, [{ serviceId: "s", quantity: 10, addons: [{ id: "scr", quantity: 4 }] }]);
    expect(r.lines[0].addons[0].amount).toBe(12);
  });
  it("ignores unknown add-ons", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 100 })]), home, [{ serviceId: "s", addons: [{ id: "nope" }] }]);
    expect(r.total).toBe(100);
  });
  it("minimum includes add-ons in the comparison", () => {
    const s = svc({ unit: "flat", rate: 100, minPrice: 150, addons: [{ id: "a", name: "A", unit: "flat", price: 60 }] });
    const r = priceQuote(cfg([s]), home, [{ serviceId: "s", addons: [{ id: "a" }] }]);
    expect(r.total).toBe(160);
    expect(r.lines[0].minimumApplied).toBe(false);
  });
  it("applies the order minimum", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 50 })], { rules: { orderMinimum: 199 } }), home, [{ serviceId: "s" }]);
    expect(r.total).toBe(199);
    expect(r.orderMinimumApplied).toBe(true);
  });
});

describe("bundles", () => {
  const two = [svc({ id: "a", unit: "flat", rate: 200 }), svc({ id: "b", unit: "flat", rate: 300 }), svc({ id: "c", unit: "flat", rate: 100 })];
  it("applies a percentage bundle for 2+ services", () => {
    const r = priceQuote(cfg(two, { bundles: [{ id: "x", name: "2+", minServices: 2, type: "pct", value: 10 }] }), home, [{ serviceId: "a" }, { serviceId: "b" }]);
    expect(r.subtotal).toBe(500);
    expect(r.discount?.amount).toBe(50);
    expect(r.total).toBe(450);
  });
  it("does not apply when too few services", () => {
    const r = priceQuote(cfg(two, { bundles: [{ id: "x", name: "2+", minServices: 2, type: "pct", value: 10 }] }), home, [{ serviceId: "a" }]);
    expect(r.discount).toBeNull();
  });
  it("picks the best bundle", () => {
    const bundles = [
      { id: "x", name: "2+", minServices: 2, type: "pct" as const, value: 10 },
      { id: "y", name: "3+", minServices: 3, type: "pct" as const, value: 15 },
    ];
    const r = priceQuote(cfg(two, { bundles }), home, [{ serviceId: "a" }, { serviceId: "b" }, { serviceId: "c" }]);
    expect(r.discount?.bundleId).toBe("y");
    expect(r.total).toBe(510);
  });
  it("applies a named package by service ids with a fixed amount", () => {
    const r = priceQuote(cfg(two, { bundles: [{ id: "p", name: "Package", serviceIds: ["a", "c"], type: "amount", value: 40 }] }), home, [{ serviceId: "a" }, { serviceId: "c" }]);
    expect(r.discount?.amount).toBe(40);
    expect(r.total).toBe(260);
  });
  it("never discounts more than the subtotal", () => {
    const r = priceQuote(cfg(two, { bundles: [{ id: "p", name: "P", minServices: 2, type: "amount", value: 9999 }] }), home, [{ serviceId: "a" }, { serviceId: "c" }]);
    expect(r.total).toBe(0);
  });
  it("nudges toward the next bundle", () => {
    const r = priceQuote(cfg(two, { bundles: [{ id: "x", name: "2+", minServices: 2, type: "pct", value: 10 }] }), home, [{ serviceId: "a" }]);
    expect(r.bundleNudge?.label).toBe("Add 1 more service to save 10%");
  });
  it("does not nudge when not enough services exist", () => {
    const r = priceQuote(cfg([two[0]], { bundles: [{ id: "x", name: "2+", minServices: 2, type: "pct", value: 10 }] }), home, [{ serviceId: "a" }]);
    expect(r.bundleNudge).toBeNull();
  });
});

describe("confirm on site, range and rounding", () => {
  it("flags homes with too many stories", () => {
    const r = priceQuote(cfg([svc({ unit: "living_sqft", rate: 0.1, confirmOnsite: { maxStories: 2 } })]), { ...home, stories: 3 }, [{ serviceId: "s" }]);
    expect(r.needsOnsiteConfirmation).toBe(true);
    expect(r.range).not.toBeNull();
  });
  it("flags large homes", () => {
    const r = priceQuote(cfg([svc({ unit: "living_sqft", rate: 0.1, confirmOnsite: { maxLivingSqft: 2000 } })]), home, [{ serviceId: "s" }]);
    expect(r.needsOnsiteConfirmation).toBe(true);
  });
  it("flags manual sizes when configured", () => {
    const r = priceQuote(cfg([svc({ unit: "living_sqft", rate: 0.1, confirmOnsite: { onManualSize: true } })]), { ...home, source: "manual" }, [{ serviceId: "s" }]);
    expect(r.lines[0].confirmOnsite).toBe(true);
  });
  it("flags missing sizes", () => {
    const r = priceQuote(cfg([svc({ unit: "roof_sqft", rate: 0.3, minPrice: 300 })]), { stories: 1, source: "none" }, [{ serviceId: "s" }]);
    expect(r.lines[0].confirmOnsite).toBe(true);
    expect(r.total).toBe(300);
  });
  it("shows a range when display mode is range", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 400 })], { rules: { displayMode: "range", rangePct: 0.1 } }), home, [{ serviceId: "s" }]);
    expect(r.range).toEqual({ low: 360, high: 440 });
  });
  it("rounds the total to the configured step", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 432.1 })], { rules: { roundTo: 5 } }), home, [{ serviceId: "s" }]);
    expect(r.total).toBe(430);
  });
  it("rounds to whole dollars by default", () => {
    expect(priceQuote(cfg([svc({ unit: "flat", rate: 99.6 })]), home, [{ serviceId: "s" }]).total).toBe(100);
  });
  it("line items add up to the total when rounding", () => {
    const r = priceQuote(DEFAULT_PRICING, home, [{ serviceId: "house_wash" }, { serviceId: "roof_wash" }]);
    const sum = r.lines.reduce((s, l) => s + l.total, 0) - (r.discount?.amount ?? 0);
    expect(sum).toBe(r.total);
  });
  it("roundTo helper", () => {
    expect(roundTo(437.5, 5)).toBe(440);
    expect(roundTo(12.4)).toBe(12);
  });
});

describe("robustness", () => {
  it("reports unknown services", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 1 })]), home, [{ serviceId: "zzz" }]);
    expect(r.errors).toHaveLength(1);
    expect(r.total).toBe(0);
  });
  it("skips inactive services", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 1, active: false })]), home, [{ serviceId: "s" }]);
    expect(r.lines).toHaveLength(0);
  });
  it("ignores duplicate selections", () => {
    const r = priceQuote(cfg([svc({ unit: "flat", rate: 100 })]), home, [{ serviceId: "s" }, { serviceId: "s" }]);
    expect(r.total).toBe(100);
  });
  it("empty selection gives a zero quote without order minimum", () => {
    const r = priceQuote(cfg([], { rules: { orderMinimum: 199 } }), home, []);
    expect(r.total).toBe(0);
  });
  it("livingSqft helper", () => {
    expect(livingSqft({ stories: 2, footprintSqft: 1000, source: "solar" })).toBe(2000);
    expect(livingSqft({ stories: 2, source: "none" })).toBeNull();
  });
});

describe("templates", () => {
  it("default pricing passes validation", () => {
    expect(pricingConfigSchema.safeParse(DEFAULT_PRICING).success).toBe(true);
  });
  it("prices a typical 2-story home with three services sensibly", () => {
    const r = priceQuote(DEFAULT_PRICING, home, [{ serviceId: "house_wash" }, { serviceId: "roof_wash" }, { serviceId: "driveway", sizeOptionId: "two_car" }]);
    expect(r.discount?.bundleId).toBe("three_plus");
    expect(r.total % 5).toBe(0);
    expect(r.total).toBeGreaterThan(700);
    expect(r.total).toBeLessThan(1600);
  });
  it("templateFor picks only the chosen services and copies them", () => {
    const t = templateFor(["windows"]);
    expect(t.services.map((s) => s.id)).toEqual(["windows"]);
    t.services[0].rate = 999;
    expect(SERVICE_TEMPLATES.find((s) => s.id === "windows")!.rate).toBe(8);
  });
  it("validation rejects flat_sqft without size options", () => {
    const bad = { services: [{ id: "x", name: "X", unit: "flat_sqft", rate: 1 }] };
    expect(pricingConfigSchema.safeParse(bad).success).toBe(false);
  });
});
