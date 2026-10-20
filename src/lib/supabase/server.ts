import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Server Supabase client authenticated with the signed-in user's Clerk JWT. */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const url = env.supabaseUrl;
  const key = env.supabaseAnonKey;
  if (!url || !key) return null;
  const { getToken } = await auth();
  return createClient(url, key, {
    accessToken: async () => (await getToken({ template: "supabase" })) ?? null,
  });
}
