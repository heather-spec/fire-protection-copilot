import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDemoIdentity } from "@/lib/demo/identity";

/**
 * Write an audit log entry. Called from every server action that
 * mutates user-visible data. Failures here are non-fatal so that a
 * broken audit log path can't take down a write.
 *
 * In demo mode, the actor is the demo identity (Heather) regardless of
 * which role the cookie currently has selected.
 */
export async function audit(opts: {
  orgId: string;
  action: string;
  targetTable: string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const supabase = createSupabaseServerClient() as unknown as {
      from: (t: string) => { insert: (v: object) => Promise<unknown> };
    };
    const { user, role } = await getDemoIdentity();
    await supabase.from("audit_logs").insert({
      org_id: opts.orgId,
      action: opts.action,
      target_table: opts.targetTable,
      target_id: opts.targetId ?? null,
      payload: { ...(opts.payload ?? {}), demo_role: role },
      actor_id: user.id,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[audit] failed to log", opts.action, e);
    }
  }
}
