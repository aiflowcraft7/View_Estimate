import type { PropertyFacts, SizeSource } from "../pricing/types";
import { perimeterFromArea } from "./estimate";

const SQFT_PER_M2 = 10.7639;
const FT_PER_M = 3.28084;
/** Roof surface is larger than the footprint (overhangs + pitch). 1.2 is typical for a 6/12 roof. */
const ROOF_TO_FOOTPRINT = 1.2;

type Measured = { footprintSqft: number | null; roofSqft: number | null; perimeterFt: number | null; roofPitchDegrees: number | null } | null;

/**
 * Builds pricing inputs from what the server measured (Solar, from cache) and
 * what the homeowner told us (stories, and optionally their home size).
 * When the homeowner overrides the size, roof and perimeter are scaled to match,
 * so every service can still be priced.
 */
export function buildPropertyFacts(measured: Measured, input: { stories: number; livingSqft?: number | null; source: SizeSource }): PropertyFacts {
  const stories = Math.min(10, Math.max(1, Math.round(input.stories || 1)));
  const override = (input.source === "manual" || input.source === "band") && input.livingSqft && input.livingSqft > 0;

  if (!override) {
    if (measured?.footprintSqft) {
      return {
        footprintSqft: measured.footprintSqft,
        roofSqft: measured.roofSqft,
        perimeterFt: measured.perimeterFt,
        roofPitchDegrees: measured.roofPitchDegrees,
        stories,
        source: "solar",
      };
    }
    return { stories, source: "none" };
  }

  const living = Math.round(input.livingSqft!);
  const footprint = Math.round(living / stories);
  if (measured?.footprintSqft && measured.roofSqft && measured.perimeterFt) {
    const scale = footprint / measured.footprintSqft;
    return {
      livingSqft: living,
      footprintSqft: footprint,
      roofSqft: Math.round(measured.roofSqft * scale),
      perimeterFt: Math.round(measured.perimeterFt * Math.sqrt(scale)),
      roofPitchDegrees: measured.roofPitchDegrees,
      stories,
      source: input.source,
    };
  }
  return {
    livingSqft: living,
    footprintSqft: footprint,
    roofSqft: Math.round(footprint * ROOF_TO_FOOTPRINT),
    perimeterFt: Math.round(perimeterFromArea(footprint / SQFT_PER_M2) * FT_PER_M),
    roofPitchDegrees: null,
    stories,
    source: input.source,
  };
}
