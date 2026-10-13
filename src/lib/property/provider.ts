import "server-only";
import { env } from "../env";
import type { SolarInsights } from "./estimate";

export type Suggestion = { placeId: string; main: string; secondary: string; text: string };
export type PlaceDetails = {
  placeId: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  zip: string | null;
  state: string | null;
};

export interface PropertyProvider {
  readonly simulated: boolean;
  autocomplete(input: string, sessionToken: string, bias?: { lat: number; lng: number; radiusMiles?: number }): Promise<Suggestion[]>;
  details(placeId: string, sessionToken?: string): Promise<PlaceDetails | null>;
  /** Returns null when Google has no building at this location. */
  buildingInsights(lat: number, lng: number): Promise<SolarInsights | null>;
}

export class ProviderError extends Error {}

// ---------- Google (live) ----------

class GoogleProvider implements PropertyProvider {
  readonly simulated = false;
  constructor(private key: string) {}

  async autocomplete(input: string, sessionToken: string, bias?: { lat: number; lng: number; radiusMiles?: number }) {
    const body: Record<string, unknown> = {
      input,
      sessionToken,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
    };
    if (bias) {
      body.locationBias = {
        circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: Math.min(50000, (bias.radiusMiles ?? 30) * 1609.34) },
      };
    }
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new ProviderError(`Places autocomplete ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[];
    };
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .map((p) => ({
        placeId: p.placeId,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
        text: p.text?.text ?? "",
      }));
  }

  async details(placeId: string, sessionToken?: string) {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": this.key, "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new ProviderError(`Place details ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const p = (await res.json()) as {
      id: string;
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
    };
    if (!p.location) return null;
    const comp = (type: string) => p.addressComponents?.find((c) => c.types?.includes(type));
    return {
      placeId: p.id,
      formattedAddress: p.formattedAddress ?? "",
      lat: p.location.latitude,
      lng: p.location.longitude,
      zip: comp("postal_code")?.shortText ?? null,
      state: comp("administrative_area_level_1")?.shortText ?? null,
    };
  }

  async buildingInsights(lat: number, lng: number) {
    const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
    url.searchParams.set("location.latitude", lat.toFixed(6));
    url.searchParams.set("location.longitude", lng.toFixed(6));
    url.searchParams.set("requiredQuality", "LOW");
    url.searchParams.set("key", this.key);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return null; // NOT_FOUND: no building data here (not billed)
    if (!res.ok) throw new ProviderError(`Solar ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as SolarInsights;
  }
}

// ---------- Simulated (no key) ----------

const CITIES = [
  { city: "Tampa", state: "FL", zip: "33602", lat: 27.9506, lng: -82.4572 },
  { city: "Charlotte", state: "NC", zip: "28202", lat: 35.2271, lng: -80.8431 },
  { city: "Austin", state: "TX", zip: "78701", lat: 30.2672, lng: -97.7431 },
  { city: "Nashville", state: "TN", zip: "37203", lat: 36.1627, lng: -86.7816 },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const encode = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const decode = (s: string) => Buffer.from(s, "base64url").toString("utf8");

/**
 * Deterministic fake addresses and building sizes so the full flow works
 * without a Google key. About 1 in 17 addresses returns no building data,
 * which exercises the manual-size fallback just like real coverage gaps.
 */
class SimulatedProvider implements PropertyProvider {
  readonly simulated = true;

  async autocomplete(input: string) {
    const q = input.trim().replace(/\s+/g, " ");
    if (q.length < 3) return [];
    const street = /^\d+/.test(q) ? q : `${100 + (hash(q) % 8900)} ${q}`;
    const pretty = street.replace(/\b\w/g, (c) => c.toUpperCase());
    return CITIES.map((c) => {
      const text = `${pretty}, ${c.city}, ${c.state} ${c.zip}, USA`;
      return { placeId: `sim_${encode(text)}`, main: pretty, secondary: `${c.city}, ${c.state}, USA`, text };
    });
  }

  async details(placeId: string) {
    if (!placeId.startsWith("sim_")) return null;
    const text = decode(placeId.slice(4));
    const c = CITIES.find((x) => text.includes(`, ${x.city}, `)) ?? CITIES[0];
    const h = hash(text);
    return {
      placeId,
      formattedAddress: text,
      lat: c.lat + ((h % 1000) - 500) / 10000,
      lng: c.lng + (((h >>> 10) % 1000) - 500) / 10000,
      zip: c.zip,
      state: c.state,
    };
  }

  async buildingInsights(lat: number, lng: number): Promise<SolarInsights | null> {
    const h = hash(`${lat.toFixed(5)},${lng.toFixed(5)}`);
    if (h % 17 === 0) return null; // some addresses have no data, like real rural coverage gaps
    const ground = 90 + (h % 120); // 90-210 m2 = about 970-2,260 sq ft footprint
    const pitch = 15 + ((h >>> 8) % 30);
    const roof = ground / Math.cos((pitch * Math.PI) / 180);
    return {
      imageryQuality: "HIGH",
      solarPotential: {
        wholeRoofStats: { areaMeters2: roof, groundAreaMeters2: ground },
        roofSegmentStats: [{ pitchDegrees: pitch, stats: { areaMeters2: roof, groundAreaMeters2: ground } }],
      },
    };
  }
}


let provider: PropertyProvider | undefined;
export function getPropertyProvider(): PropertyProvider {
  if (!provider) provider = env.googleServerKey ? new GoogleProvider(env.googleServerKey) : new SimulatedProvider();
  return provider;
}

/** Test hook. */
export function setPropertyProvider(p: PropertyProvider | undefined) {
  provider = p;
}
