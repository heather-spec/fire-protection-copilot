import "server-only";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Organization, Profile, UserRole } from "@/lib/db/types";

/**
 * DEMO MODE — auth is disabled.
 *
 * Every server-side "current user" lookup returns the same demo profile
 * (Heather) but with a role picked from the `demo_role` cookie. The
 * topbar role switcher just sets that cookie and the next render reflects
 * the new role. RLS is bypassed because all server queries now use the
 * service-role key (see lib/supabase/server.ts).
 */

export const DEMO_EMAIL = "hnianouris@gmail.com";
export const DEMO_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const ROLE_COOKIE = "demo_role";

const VALID_ROLES: UserRole[] = ["admin", "reviewer", "technician"];

export function getDemoRole(): UserRole {
  const cookie = cookies().get(ROLE_COOKIE)?.value;
  if (cookie && (VALID_ROLES as string[]).includes(cookie)) {
    return cookie as UserRole;
  }
  return "admin";
}

// Cache the looked-up demo profile + org for the lifetime of this server
// process so we're not pinging Supabase on every request.
let cached:
  | { user: { id: string; email: string }; profile: Profile; org: Organization }
  | null = null;

export async function getDemoIdentity() {
  if (cached) return { ...cached, role: getDemoRole() };

  const supabase = createSupabaseAdminClient();

  // 1. Profile (and matching auth user id, since profile.id === auth.users.id)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", DEMO_EMAIL)
    .maybeSingle();
  const profile = profileRow as Profile | null;

  if (!profile) {
    throw new Error(
      `Demo profile not found for ${DEMO_EMAIL}. Create the account first or update DEMO_EMAIL.`,
    );
  }

  // 2. Org
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", DEMO_ORG_ID)
    .maybeSingle();
  const org = orgRow as Organization | null;

  if (!org) {
    throw new Error("Demo organization not found. Run the base seed.");
  }

  cached = {
    user: { id: profile.id, email: profile.email },
    profile,
    org,
  };

  return { ...cached, role: getDemoRole() };
}

/** Reset the cache — useful if the demo user changes mid-process (tests). */
export function _resetDemoIdentityCache() {
  cached = null;
}
