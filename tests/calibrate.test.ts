import { describe, expect, it } from "vitest";
import { SAMPLE_HOME, sampleJobLabel, samplePrice, sampleSelection, scaleService } from "@/lib/pricing/calibrate";
import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";
import type { ServiceConfig } from "@/lib/pricing/types";

function houseWash(): ServiceConfig {
  return structuredClone(SERVICE_TEMPLATES.find((s) => s.id === "house_wash")!);
}

describe("calibrate", () => {
  it("prices the sample home with a stable selection", () => {
    const svc = houseWash();
    expect(sampleSelection(svc)).toEqual({ serviceId: "house_wash" });
    expect(sampleJobLabel(svc)).toMatch(/2-story/);
    expect(SAMPLE_HOME.livingSqft).toBe(2000);
    expect(samplePrice(svc)).toBeGreaterThan(0);
  });

  it("doubles and halves rates, mins and addons together", () => {
    const svc = houseWash();
    const base = samplePrice(svc);
    const doubled = scaleService(svc, base * 2);
    expect(samplePrice(doubled)).toBe(base * 2);
    expect(doubled.rate).toBeCloseTo(svc.rate * 2, 4);
    expect(doubled.minPrice).toBe(Math.round((svc.minPrice ?? 0) * 2));
    if (svc.addons?.length && doubled.addons?.length) {
      expect(doubled.addons[0].price).toBeCloseTo(svc.addons[0].price * 2, 1);
    }

    const half = scaleService(doubled, base);
    expect(samplePrice(half)).toBe(base);
  });

  it("returns the same service when target equals current or is invalid", () => {
    const svc = houseWash();
    const price = samplePrice(svc);
    expect(scaleService(svc, price)).toBe(svc);
    expect(scaleService(svc, 0)).toBe(svc);
    expect(scaleService(svc, -10)).toBe(svc);
  });

  it("picks a mid size option for flat_sqft and a window quantity", () => {
    const driveway = SERVICE_TEMPLATES.find((s) => s.id === "driveway")!;
    const sel = sampleSelection(driveway);
    expect(sel.sizeOptionId).toBeTruthy();
    expect(samplePrice(driveway)).toBeGreaterThan(0);

    const windows = SERVICE_TEMPLATES.find((s) => s.id === "windows")!;
    expect(sampleSelection(windows)).toEqual({ serviceId: "windows", quantity: 15 });
  });
});
