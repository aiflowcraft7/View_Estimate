/**
 * Turns a Google Solar API buildingInsights response into the measurements the
 * pricing engine needs. Pure, so it is unit tested against sample responses.
 *
 * Solar returns roof surface area (sloped) and its ground footprint, plus pitch
 * per roof segment. It does not return story count or wall area, so the
 * homeowner confirms stories in the widget.
 */
const SQFT_PER_M2 = 10.7639;
const FT_PER_M = 3.28084;

export type SolarInsights = {
  name?: string;
  center?: { latitude: number; longitude: number };
  imageryQuality?: "HIGH" | "MEDIUM" | "LOW" | string;
  boundingBox?: { sw: { latitude: number; longitude: number }; ne: { latitude: number; longitude: number } };
  solarPotential?: {
    wholeRoofStats?: { areaMeters2?: number; groundAreaMeters2?: number };
    buildingStats?: { areaMeters2?: number; groundAreaMeters2?: number };
    roofSegmentStats?: { pitchDegrees?: number; stats?: { areaMeters2?: number; groundAreaMeters2?: number } }[];
  };
};

export type SizeEstimate = {
  footprintSqft: number;
  roofSqft: number;
  roofPitchAvg: number | null;
  perimeterFt: number;
};

/** Typical house plan aspect ratio (length / width) used to estimate perimeter from area. */
const ASPECT = 1.6;
/** Real footprints are not perfect rectangles; corners and bump-outs add edge length. */
const PERIMETER_COMPLEXITY = 1.12;

export function estimateFromSolar(s: SolarInsights): SizeEstimate | null {
  const sp = s.solarPotential;
  const roofM2 = sp?.wholeRoofStats?.areaMeters2 ?? sp?.buildingStats?.areaMeters2;
  const groundM2 = sp?.wholeRoofStats?.groundAreaMeters2 ?? sp?.buildingStats?.groundAreaMeters2;
  if (!roofM2 || !groundM2 || groundM2 < 15) return null; // under ~160 sq ft is a shed or noise

  const segs = sp?.roofSegmentStats ?? [];
  let pitchWeighted = 0;
  let pitchArea = 0;
  for (const seg of segs) {
    const a = seg.stats?.areaMeters2 ?? 0;
    if (seg.pitchDegrees != null && a > 0) {
      pitchWeighted += seg.pitchDegrees * a;
      pitchArea += a;
    }
  }

  const footprintSqft = groundM2 * SQFT_PER_M2;
  return {
    footprintSqft: Math.round(footprintSqft),
    roofSqft: Math.round(roofM2 * SQFT_PER_M2),
    roofPitchAvg: pitchArea ? Math.round((pitchWeighted / pitchArea) * 10) / 10 : null,
    perimeterFt: Math.round(perimeterFromArea(groundM2) * FT_PER_M),
  };
}

/** Perimeter in meters of a rectangle with the given area and ASPECT, with a complexity factor. */
export function perimeterFromArea(areaM2: number): number {
  const width = Math.sqrt(areaM2 / ASPECT);
  return 2 * (width + width * ASPECT) * PERIMETER_COMPLEXITY;
}
