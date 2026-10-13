import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { propertiesCache } from "../db/schema";
import { env } from "../env";
import { reportError } from "../monitoring";
import { addUsage, usageToday } from "../usage";
import { estimateFromSolar } from "./estimate";
import { getPropertyProvider } from "./provider";

const CACHE_DAYS = 90;

export type PropertyLookup = {
  placeId: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  zip: string | null;
  state: string | null;
  footprintSqft: number | null;
  roofSqft: number | null;
  roofPitchAvg: number | null;
  perimeterFt: number | null;
  source: "solar" | "none";
  cached: boolean;
};

export type LookupOutcome = { ok: true; property: PropertyLookup } | { ok: false; reason: "not_found" | "budget" | "error" };

/**
 * Address -> coordinates -> building size, cached per Google place id for 90 days
 * so repeat lookups cost nothing. Never throws: on any failure the widget falls
 * back to asking the homeowner for their home size.
 */
export async function lookupProperty(placeId: string, sessionToken: string | undefined, businessId: string): Promise<LookupOutcome> {
  const db = await getDb();
  const cached = await db.select().from(propertiesCache).where(eq(propertiesCache.placeId, placeId)).limit(1);
  const hit = cached[0];
  if (hit && Date.now() - hit.fetchedAt.getTime() < CACHE_DAYS * 86400_000) {
    return {
      ok: true,
      property: {
        placeId: hit.placeId,
        formattedAddress: hit.formattedAddress,
        lat: hit.lat,
        lng: hit.lng,
        zip: hit.zip,
        state: hit.state,
        footprintSqft: hit.footprintSqft,
        roofSqft: hit.roofSqft,
        roofPitchAvg: hit.roofPitchAvg,
        perimeterFt: hit.perimeterFt,
        source: hit.source,
        cached: true,
      },
    };
  }

  const provider = getPropertyProvider();
  if (!provider.simulated) {
    const used = (await usageToday("solar", "global")) + (await usageToday("places_details", "global"));
    if (used >= env.googleDailyCallBudget * 2) {
      reportError(new Error("Google daily call budget reached"), { businessId });
      return { ok: false, reason: "budget" };
    }
  }

  try {
    const details = await provider.details(placeId, sessionToken);
    if (!provider.simulated) await Promise.all([addUsage("places_details", "global"), addUsage("places_details", businessId)]);
    if (!details) return { ok: false, reason: "not_found" };

    const insights = await provider.buildingInsights(details.lat, details.lng);
    if (!provider.simulated) await Promise.all([addUsage("solar", "global"), addUsage("solar", businessId)]);
    const size = insights ? estimateFromSolar(insights) : null;

    const row = {
      placeId: details.placeId,
      lat: details.lat,
      lng: details.lng,
      formattedAddress: details.formattedAddress,
      zip: details.zip,
      state: details.state,
      footprintSqft: size?.footprintSqft ?? null,
      roofSqft: size?.roofSqft ?? null,
      roofPitchAvg: size?.roofPitchAvg ?? null,
      perimeterFt: size?.perimeterFt ?? null,
      source: (size ? "solar" : "none") as "solar" | "none",
      fetchedAt: new Date(),
    };
    await db.insert(propertiesCache).values(row).onConflictDoUpdate({ target: propertiesCache.placeId, set: row });
    return { ok: true, property: { ...row, cached: false } };
  } catch (e) {
    reportError(e, { where: "lookupProperty", placeId, businessId });
    return { ok: false, reason: "error" };
  }
}
