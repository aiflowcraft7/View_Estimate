"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requestMagicLink, safeNext } from "@/lib/auth";
import { reportError } from "@/lib/monitoring";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export type LoginState = { error?: string; sent?: string };

export async function sendLoginLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = z.string().trim().email().max(200).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const ip = clientIp(await headers());
  if (!(await rateLimit(`login:ip:${ip}`, 10, 600)) || !(await rateLimit(`login:email:${email.data.toLowerCase()}`, 5, 600))) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  try {
    await requestMagicLink(email.data, safeNext(String(form.get("next") ?? "")));
  } catch (e) {
    reportError(e, { where: "login" });
    return { error: "We couldn't send the email. Please try again." };
  }
  return { sent: email.data };
}

export async function googleSignIn(form: FormData) {
  redirect(`/auth/google?next=${encodeURIComponent(safeNext(String(form.get("next") ?? "")))}`);
}
