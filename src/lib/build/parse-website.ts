import { SERVICE_TEMPLATES } from "@/lib/pricing/templates";

export type DigResult = {
  website: string;
  name: string;
  phone: string | null;
  alertEmail: string | null;
  brandColor: string;
  serviceIds: string[];
  zips: string[];
  confidence: "high" | "low";
};

export const DEFAULT_BRAND_COLOR = "#0f766e";
export const DEFAULT_SERVICE_IDS = ["house_wash", "roof_wash", "driveway"];

const SERVICE_KEYWORDS: { id: string; words: string[] }[] = [
  { id: "gutter_brightening", words: ["gutter brightening", "tiger stripe", "gutter face"] },
  { id: "gutter_cleaning", words: ["gutter cleaning", "clean gutters", "gutter clean", "downspout"] },
  { id: "roof_wash", words: ["roof soft wash", "roof cleaning", "roof wash", "black streak", "moss and algae"] },
  { id: "house_wash", words: ["house wash", "soft wash", "pressure wash", "power wash", "exterior clean", "siding wash", "house cleaning"] },
  { id: "driveway", words: ["driveway", "concrete cleaning", "concrete wash", "sidewalk clean"] },
  { id: "patio", words: ["patio", "pool deck", "deck cleaning", "deck wash"] },
  { id: "windows", words: ["window cleaning", "window wash", "glass cleaning"] },
];

export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "127.0.0.1" || v === "::1" || v === "0.0.0.0" || v === "::") return true;
  if (v.startsWith("10.") || v.startsWith("192.168.") || v.startsWith("169.254.")) return true;
  const m = v.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:")) return true;
  return false;
}

export function normalizeWebsiteUrl(input: string): URL | null {
  let raw = input.trim();
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname || u.hostname.includes(" ")) return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  return (m?.[1] || m?.[2] || "").trim() || null;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function cleanName(raw: string | null | undefined): string {
  if (!raw) return "";
  let n = raw.replace(/\s+/g, " ").trim();
  n = n.split(/\s*[|\u2013\u2014\-]\s*/)[0]?.trim() ?? n;
  if (/^(home|welcome|index|untitled|website)$/i.test(n) || n.length < 2) return "";
  return n.slice(0, 80);
}

function firstTel(html: string): string | null {
  const tel = html.match(/href=["']tel:([^"']+)["']/i);
  if (tel?.[1]) return tel[1].replace(/\s+/g, " ").trim().slice(0, 30);
  const us = html.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return us?.[0]?.trim().slice(0, 30) ?? null;
}

function firstEmail(html: string): string | null {
  const mails = [...html.matchAll(/href=["']mailto:([^"'?]+)/gi)].map((m) => m[1].trim().toLowerCase());
  for (const e of mails) {
    if (!e.includes("@") || /noreply|no-reply|donotreply|mailer-daemon/i.test(e)) continue;
    return e.slice(0, 120);
  }
  return null;
}

function themeColor(html: string): string {
  const meta = metaContent(html, "theme-color");
  if (meta && /^#?[0-9a-fA-F]{6}$/.test(meta.trim())) {
    return meta.trim().startsWith("#") ? meta.trim() : `#${meta.trim()}`;
  }
  const hex = html.match(/#([0-9a-fA-F]{6})\b/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    if (r + g + b < 40 || r + g + b > 720) return DEFAULT_BRAND_COLOR;
    return `#${hex[1]}`;
  }
  return DEFAULT_BRAND_COLOR;
}

function detectServices(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const row of SERVICE_KEYWORDS) {
    if (row.words.some((w) => lower.includes(w))) found.push(row.id);
  }
  const valid = new Set(SERVICE_TEMPLATES.map((s) => s.id));
  const ids = [...new Set(found)].filter((id) => valid.has(id));
  return ids.length ? ids : [...DEFAULT_SERVICE_IDS];
}

function detectZips(text: string): string[] {
  return [...new Set((text.match(/\b\d{5}\b/g) ?? []).slice(0, 5))];
}

/** Pure HTML parse — used by digWebsite and unit tests. */
export function parseWebsiteHtml(html: string, website: string): DigResult {
  const name = cleanName(metaContent(html, "og:site_name") || metaContent(html, "og:title") || titleTag(html));
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const tail = text.slice(-8000);
  const fromKeywords = SERVICE_KEYWORDS.some((row) => row.words.some((w) => text.toLowerCase().includes(w)));
  return {
    website,
    name,
    phone: firstTel(html),
    alertEmail: firstEmail(html),
    brandColor: themeColor(html),
    serviceIds: detectServices(text),
    zips: detectZips(tail),
    confidence: name && fromKeywords ? "high" : "low",
  };
}
