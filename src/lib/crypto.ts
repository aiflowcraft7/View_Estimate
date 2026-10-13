import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function key(): Buffer {
  return createHash("sha256").update(`enc:${env.appSecret}`).digest();
}

/** AES-256-GCM. Used for OAuth tokens and webhook secrets stored in the database. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  try {
    return JSON.parse(decrypt(payload)) as T;
  } catch {
    return null;
  }
}

/** Short-lived signed values (OAuth state, etc). */
export function signValue(value: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${Buffer.from(value).toString("base64url")}.${exp}`;
  return `${body}.${hmacSha256Hex(env.appSecret, body).slice(0, 32)}`;
}

export function verifySignedValue(signed: string): string | null {
  const parts = signed.split(".");
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(parts[2], hmacSha256Hex(env.appSecret, body).slice(0, 32))) return null;
  if (Number(parts[1]) < Date.now() / 1000) return null;
  return Buffer.from(parts[0], "base64url").toString("utf8");
}
