import "server-only";
import { getPropertyProvider } from "./property/provider";
import { randomToken } from "./crypto";

/** Resolves free text ("Tampa, FL" or a street address) to coordinates using the first Places match. */
export async function geocodeText(text: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = text.trim();
  if (q.length < 3) return null;
  const provider = getPropertyProvider();
  const token = randomToken(16);
  try {
    const [first] = await provider.autocomplete(q, token);
    if (!first) return null;
    const d = await provider.details(first.placeId, token);
    return d ? { lat: d.lat, lng: d.lng, label: d.formattedAddress } : null;
  } catch {
    return null;
  }
}

/** "33602, 33603 33604\n33605" -> ["33602", ...] (5-digit ZIPs only, deduped) */
export function parseZips(text: string): string[] {
  return [...new Set((text.match(/\b\d{5}\b/g) ?? []).slice(0, 500))];
}
