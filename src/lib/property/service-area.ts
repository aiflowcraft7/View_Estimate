import type { ServiceArea } from "../db/schema";

export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * True when the address is inside the business's service area.
 * An empty service area means "serve everywhere".
 * A ZIP match OR being inside the radius counts as in-area.
 */
export function inServiceArea(area: ServiceArea, where: { zip?: string | null; lat?: number | null; lng?: number | null }): boolean {
  const zips = (area.zips ?? []).map((z) => z.trim()).filter(Boolean);
  const hasRadius = !!(area.center && area.radiusMiles && area.radiusMiles > 0);
  if (!zips.length && !hasRadius) return true;
  if (where.zip && zips.includes(where.zip.slice(0, 5))) return true;
  if (hasRadius && where.lat != null && where.lng != null) {
    return distanceMiles(area.center!, { lat: where.lat, lng: where.lng }) <= area.radiusMiles!;
  }
  return false;
}
