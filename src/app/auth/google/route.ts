import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth";
import { signValue } from "@/lib/crypto";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  if (!env.googleOAuthClientId) return NextResponse.redirect(new URL("/login", env.appUrl));
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env.googleOAuthClientId);
  u.searchParams.set("redirect_uri", `${env.appUrl}/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("prompt", "select_account");
  u.searchParams.set("state", signValue(next, 600));
  return NextResponse.redirect(u);
}
