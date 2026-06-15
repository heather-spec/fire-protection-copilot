import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * DEMO MODE — server-side Supabase client uses the service-role key,
 * which bypasses RLS. We are no longer relying on auth.uid() to scope
 * data; the demo identity layer (lib/demo/identity.ts) defines who the
 * "current user" is for the purposes of audit logging and role gating.
 *
 * Do NOT import this from a client component — service-role bypasses
 * RLS and would leak everything if exposed to the browser.
 */
export function createSupabaseServerClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
