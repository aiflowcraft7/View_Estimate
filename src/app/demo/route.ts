import { redirect } from "next/navigation";
import { DEMO_SLUG, ensureDemoBusiness } from "@/lib/demo";

export async function GET() {
  await ensureDemoBusiness();
  redirect(`/q/${DEMO_SLUG}`);
}
