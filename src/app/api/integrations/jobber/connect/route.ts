import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/auth";
import { canUseIntegration } from "@/lib/billing/plans";
import { signValue } from "@/lib/crypto";
import { env } from "@/lib/env";
import { jobberAuthorizeUrl, jobberEnabled } from "@/lib/integrations/jobber";

export async function GET() {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.redirect(new URL("/login?next=/app/integrations", env.appUrl));
  if (!jobberEnabled() || !canUseIntegration(ctx.business.plan, "jobber")) return NextResponse.redirect(new URL("/app/integrations", env.appUrl));
  const state = signValue(JSON.stringify({ b: ctx.business.id, u: ctx.user.id }), 900);
  return NextResponse.redirect(jobberAuthorizeUrl(state));
}
