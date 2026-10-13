import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";

/** Validates X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted(key+value)...)). */
export function verifyTwilio(authToken: string, url: string, params: URLSearchParams, signature: string | null): boolean {
  if (!signature) return false;
  const keys = [...new Set(params.keys())].sort();
  const data = url + keys.map((k) => k + params.getAll(k).join("")).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return safeEqual(expected, signature);
}
