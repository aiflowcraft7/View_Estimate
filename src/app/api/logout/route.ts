import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/** Clear app cookies, then hand off so Clerk can clear its session cookie. */
export async function POST() {
  const jar = await cookies();
  jar.delete("ve_business");
  jar.delete("ve_acting_business");
  return NextResponse.redirect(new URL("/logout", env.appUrl), 303);
}
