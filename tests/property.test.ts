import { describe, expect, it } from "vitest";
import { estimateFromSolar, perimeterFromArea } from "@/lib/property/estimate";
import { distanceMiles, inServiceArea } from "@/lib/property/service-area";
import { lookupProperty } from "@/lib/property/lookup";
import { getPropertyProvider } from "@/lib/property/provider";

describe("estimateFromSolar", () => {
  it("converts square meters and weights pitch by segment area", () => {
    const r = estimateFromSolar({
      solarPotential: {
        wholeRoofStats: { areaMeters2: 200, groundAreaMeters2: 160 },
        roofSegmentStats: [
          { pitchDegrees: 20, stats: { areaMeters2: 150 } },
          { pitchDegrees: 40, stats: { areaMeters2: 50 } },
        ],
      },
    })!;
    expect(r.roofSqft).toBe(2153);
    expect(r.footprintSqft).toBe(1722);
    expect(r.roofPitchAvg).toBe(25);
    expect(r.perimeterFt).toBeGreaterThan(160);
    expect(r.perimeterFt).toBeLessThan(220);
  });
  it("returns null for missing or tiny buildings", () => {
    expect(estimateFromSolar({})).toBeNull();
    expect(estimateFromSolar({ solarPotential: { wholeRoofStats: { areaMeters2: 10, groundAreaMeters2: 8 } } })).toBeNull();
  });
  it("perimeter of a 100 m2 1.6:1 rectangle is about 41 m before complexity", () => {
    expect(perimeterFromArea(100) / 1.12).toBeCloseTo(41.1, 0);
  });
});

describe("service area", () => {
  const tampa = { lat: 27.9506, lng: -82.4572 };
  it("empty area serves everywhere", () => expect(inServiceArea({}, { zip: "90210" })).toBe(true));
  it("matches ZIP codes", () => {
    expect(inServiceArea({ zips: ["33602"] }, { zip: "33602-1234" })).toBe(true);
    expect(inServiceArea({ zips: ["33602"] }, { zip: "33603" })).toBe(false);
  });
  it("matches by radius", () => {
    expect(inServiceArea({ center: tampa, radiusMiles: 20 }, { lat: 28.0, lng: -82.5 })).toBe(true);
    expect(inServiceArea({ center: tampa, radiusMiles: 20 }, { lat: 30.2672, lng: -97.7431 })).toBe(false);
  });
  it("distance Tampa to Orlando is about 79 miles", () => {
    expect(distanceMiles(tampa, { lat: 28.5384, lng: -81.3789 })).toBeGreaterThan(75);
    expect(distanceMiles(tampa, { lat: 28.5384, lng: -81.3789 })).toBeLessThan(85);
  });
});

describe("lookupProperty (simulated provider + embedded database)", () => {
  it("looks up, estimates and caches", async () => {
    const p = getPropertyProvider();
    expect(p.simulated).toBe(true);
    const [s] = await p.autocomplete("123 Palm Ave", "tok");
    const first = await lookupProperty(s.placeId, "tok", "00000000-0000-0000-0000-000000000000");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.property.cached).toBe(false);
    expect(first.property.zip).toBe("33602");
    const second = await lookupProperty(s.placeId, "tok", "00000000-0000-0000-0000-000000000000");
    expect(second.ok && second.property.cached).toBe(true);
  });
  it("returns not_found for unknown place ids", async () => {
    const r = await lookupProperty("nope", undefined, "00000000-0000-0000-0000-000000000000");
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });
});
