import { NextResponse } from "next/server";
import { audit, getBusinessContext } from "@/lib/auth";
import { encryptJson, verifySignedValue } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { exchangeJobberCode } from "@/lib/integrations/jobber";
import { reportError } from "@/lib/monitoring";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (s: string) => NextResponse.redirect(new URL(`/app/integrations?jobber=${s}`, env.appUrl));
  const raw = verifySignedValue(url.searchParams.get("state") ?? "");
  const code = url.searchParams.get("code");
  const ctx = await getBusinessContext();
  if (!raw || !code || !ctx) return back("error");
  const state = JSON.parse(raw) as { b: string; u: string };
  // The state must match the signed-in user and their current business.
  if (state.b !== ctx.business.id || state.u !== ctx.user.id) return back("error");
  try {
    const tokens = await exchangeJobberCode(code);
    const db = await getDb();
    await db
      .insert(integrations)
      .values({ businessId: ctx.business.id, type: "jobber", credentials: encryptJson(tokens), status: "active" })
      .onConflictDoUpdate({ target: [integrations.businessId, integrations.type], set: { credentials: encryptJson(tokens), status: "active", lastError: null } });
    await audit(ctx.user.id, ctx.business.id, "integration.jobber.connect");
    return back("connected");
  } catch (e) {
    reportError(e, { where: "jobber-callback" });
    return back("error");
  }
}
