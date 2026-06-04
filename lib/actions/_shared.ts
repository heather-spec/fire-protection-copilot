import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrg, getCurrentUser } from "@/lib/db/queries";
import type { UserRole } from "@/lib/db/types";

/**
 * Loose write-side client. Read flows go through `lib/db/queries.ts` which
 * returns strongly-typed shapes. For mutations we trust schema + RLS + Zod
 * at the form layer; trying to align supabase-js's deep generic inference
 * with our hand-rolled Database type fights the toolchain for no gain at MVP.
 */
// Reads go through lib/db/queries.ts (strongly typed).
// For writes, we wrap the supabase client in a loose handle — the schema
// + RLS + form validation are the actual safety net for mutations.
type AnyClient = {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> };
  from(table: string): {
    insert: (values: object) => AnyChain;
    update: (values: object) => AnyChain;
    delete: () => AnyChain;
    select: (cols?: string, opts?: object) => AnyChain;
  };
};
interface AnyChain extends Promise<{ data: any; error: { message: string } | null; count: number | null }> {
  eq: (col: string, val: unknown) => AnyChain;
  in: (col: string, vals: unknown[]) => AnyChain;
  gte: (col: string, val: unknown) => AnyChain;
  order: (col: string, opts?: object) => AnyChain;
  limit: (n: number) => AnyChain;
  select: (cols?: string, opts?: object) => AnyChain;
  single: () => Promise<{ data: any; error: { message: string } | null }>;
  maybeSingle: () => Promise<{ data: any; error: { message: string } | null }>;
}

type WriteClient = AnyClient;

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Resolve auth + active org or throw to login. */
export async function requireOrg() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const active = await getActiveOrg();
  if (!active) redirect("/dashboard");
  return { user, orgId: active.org.id, role: active.role };
}

export function requireRole(role: UserRole, allowed: UserRole[]): asserts role {
  if (!allowed.includes(role)) {
    throw new Error("forbidden");
  }
}

export function supa(): WriteClient {
  return createSupabaseServerClient() as unknown as WriteClient;
}

export function asString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function asOptional(form: FormData, key: string): string | null {
  const v = asString(form, key);
  return v.length === 0 ? null : v;
}

export function asInt(form: FormData, key: string): number | null {
  const v = asString(form, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function asBool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}
