import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Write an audit log entry. Called from every server action that
 * mutates user-visible data. Failures here are non-fatal so that a
 * broken audit log path can't take down a write.
 */
export async function audit(opts: {
  orgId: string;
  action: string;
  targetTable: string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const supabase = createSupabaseServerClient() as any;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      org_id: opts.orgId,
      action: opts.action,
      target_table: opts.targetTable,
      target_id: opts.targetId ?? null,
      payload: opts.payload ?? {},
      actor_id: u.user?.id ?? null,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[audit] failed to log", opts.action, e);
    }
  }
}
