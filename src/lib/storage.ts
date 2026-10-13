import "server-only";
import { eq } from "drizzle-orm";
import { hmacSha256Hex, safeEqual } from "./crypto";
import { getDb } from "./db";
import { devFiles } from "./db/schema";
import { env } from "./env";

/**
 * File storage for logos and homeowner photos.
 * - Supabase Storage (private bucket) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 * - Otherwise files are kept in the database (fine for local development).
 * Files are always served through /files/..., which checks access and then
 * streams or redirects to a short-lived signed URL.
 */

function supabase() {
  return env.supabaseUrl && env.supabaseServiceKey ? { url: env.supabaseUrl.replace(/\/$/, ""), key: env.supabaseServiceKey, bucket: env.storageBucket } : null;
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/svg+xml": "svg", "image/gif": "gif" };

/** Checks magic bytes so a renamed file can't pose as an image. SVG is only allowed for logos. */
export function sniffImage(bytes: Uint8Array, allowSvg = false): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /heic|heix|mif1|msf1|heif/.test(ascii(8, 12))) return "image/heic";
  if (allowSvg) {
    const head = new TextDecoder().decode(b.slice(0, 512)).trim().toLowerCase();
    if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  }
  return null;
}

export async function putFile(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.key}`, "Content-Type": contentType, "x-upsert": "true" },
      body: Buffer.from(bytes),
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return;
  }
  const db = await getDb();
  const data = Buffer.from(bytes).toString("base64");
  await db.insert(devFiles).values({ path, contentType, data }).onConflictDoUpdate({ target: devFiles.path, set: { contentType, data } });
}

export type FileResponse = { redirect: string } | { body: Uint8Array; contentType: string } | null;

export async function readFile(path: string): Promise<FileResponse> {
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/sign/${sb.bucket}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 600 }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { signedURL?: string };
    return json.signedURL ? { redirect: `${sb.url}/storage/v1${json.signedURL}` } : null;
  }
  const db = await getDb();
  const [row] = await db.select().from(devFiles).where(eq(devFiles.path, path)).limit(1);
  return row ? { body: Buffer.from(row.data, "base64"), contentType: row.contentType } : null;
}

/** Public path for a stored file (logos are public; photos need a signature or the owner's session). */
export function fileUrl(path: string): string {
  return `${env.appUrl}/files/${path}`;
}

/** Signed link valid for `days`, for alert emails and CRM payloads. */
export function signedFileUrl(path: string, days = 30): string {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const sig = hmacSha256Hex(env.appSecret, `file:${path}:${exp}`).slice(0, 32);
  return `${env.appUrl}/files/${path}?exp=${exp}&sig=${sig}`;
}

export function verifyFileSignature(path: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, hmacSha256Hex(env.appSecret, `file:${path}:${exp}`).slice(0, 32));
}
