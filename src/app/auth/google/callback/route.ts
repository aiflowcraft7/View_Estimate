import { NextResponse } from "next/server";
import { createSession, safeNext, upsertUser } from "@/lib/auth";
import { verifySignedValue } from "@/lib/crypto";
import { env } from "@/lib/env";
import { reportError } from "@/lib/monitoring";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = () => NextResponse.redirect(new URL("/login?error=google", env.appUrl));
  const next = verifySignedValue(url.searchParams.get("state") ?? "");
  const code = url.searchParams.get("code");
  if (!next || !code || !env.googleOAuthClientId || !env.googleOAuthClientSecret) return fail();
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleOAuthClientId,
        client_secret: env.googleOAuthClientSecret,
        redirect_uri: `${env.appUrl}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return fail();
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
    if (!info.email || !info.email_verified) return fail();
    const user = await upsertUser(info.email, info.name);
    await createSession(user.id);
    return NextResponse.redirect(new URL(safeNext(next), env.appUrl));
  } catch (e) {
    reportError(e, { where: "google-callback" });
    return fail();
  }
}
