import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { reportError } from "./monitoring";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function apiError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function parseJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: apiError(400, "Invalid JSON") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, res: apiError(400, "Invalid input", { issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }) };
  return { ok: true, data: parsed.data };
}

/** Wraps a route handler so unexpected errors are reported and return a clean 500. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      // Next.js uses thrown errors for redirect()/notFound(); let those through.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
      reportError(e, { route: true });
      return apiError(500, "Something went wrong. Please try again.");
    }
  };
}
