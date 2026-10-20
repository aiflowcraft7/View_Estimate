"use client";

import { useAuth } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

/** Supabase client that sends your Clerk session JWT (use the `supabase` JWT template in Clerk). */
export function useSupabase(): SupabaseClient | null {
  const { getToken } = useAuth();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return useMemo(() => {
    if (!url || !key) return null;
    return createClient(url, key, {
      accessToken: async () => (await getToken({ template: "supabase" })) ?? null,
    });
  }, [getToken, url, key]);
}
