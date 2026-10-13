"use server";

import { redirect } from "next/navigation";
import { getBusinessContext, requireUser, setActiveBusiness, startActingAs } from "@/lib/auth";

export async function stopActingAs() {
  const user = await requireUser();
  if (user.isPlatformAdmin) await startActingAs(user, null);
  redirect("/admin");
}

export async function switchBusiness(form: FormData) {
  const ctx = await getBusinessContext();
  const id = String(form.get("businessId") ?? "");
  if (ctx?.memberships.some((m) => m.id === id)) await setActiveBusiness(id);
  redirect("/app");
}
