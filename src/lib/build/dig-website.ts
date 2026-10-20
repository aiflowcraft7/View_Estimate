import "server-only";
import dns from "node:dns/promises";
import {
  isPrivateIp,
  normalizeWebsiteUrl,
  parseWebsiteHtml,
  type DigResult,
} from "./parse-website";

export type { DigResult };
export { isPrivateIp, normalizeWebsiteUrl, parseWebsiteHtml } from "./parse-website";

const MAX_BYTES = 1_000_000;
const FETCH_MS = 8000;
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata", "0.0.0.0"]);

export async function assertSafeUrl(url: URL): Promise<void> {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That website address is not allowed");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIp(host)) {
    throw new Error("That website address is not allowed");
  }
  const bare = host.replace(/^\[|\]$/g, "");
  if (bare.includes(":") && isPrivateIp(bare)) {
    throw new Error("That website address is not allowed");
  }
  try {
    const { address } = await dns.lookup(host);
    if (isPrivateIp(address)) throw new Error("That website address is not allowed");
  } catch (e) {
    if (e instanceof Error && e.message.includes("not allowed")) throw e;
    throw new Error("We couldn't reach that website");
  }
}

async function fetchHtml(url: URL): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertSafeUrl(current);
    const res = await fetch(current.href, {
      redirect: "manual",
      headers: {
        "User-Agent": "ViewEstimateBot/1.0 (+https://viewestimate.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("We couldn't read that website");
      current = new URL(loc, current);
      continue;
    }
    if (!res.ok) throw new Error("We couldn't read that website");
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype && !/text\/html|application\/xhtml/i.test(ctype) && !/text\/plain/i.test(ctype)) {
      throw new Error("That address doesn't look like a website page");
    }
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  }
  throw new Error("Too many redirects");
}

/**
 * Free homepage dig: fetch HTML and extract name, color, services, contact hints.
 * Throws a user-facing Error when the site is unreachable or has no usable name.
 */
export async function digWebsite(input: string): Promise<DigResult> {
  const httpsUrl = normalizeWebsiteUrl(input);
  if (!httpsUrl) throw new Error("Enter a valid website address");

  let html: string;
  try {
    html = await fetchHtml(httpsUrl);
  } catch (e) {
    if (httpsUrl.protocol === "https:") {
      const httpUrl = new URL(httpsUrl.href);
      httpUrl.protocol = "http:";
      try {
        html = await fetchHtml(httpUrl);
      } catch {
        throw e instanceof Error ? e : new Error("We couldn't reach that website");
      }
    } else {
      throw e instanceof Error ? e : new Error("We couldn't reach that website");
    }
  }

  const result = parseWebsiteHtml(html, httpsUrl.origin);
  if (!result.name) throw new Error("We couldn't find your business name on that site");
  return result;
}
