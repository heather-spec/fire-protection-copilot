"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/db/audit";
import type {
  DeficiencyPriority,
  DeficiencySeverity,
  DeficiencyStatus,
} from "@/lib/db/types";
import {
  ActionResult,
  asOptional,
  asString,
  requireOrg,
  supa,
} from "./_shared";

const SEV: DeficiencySeverity[] = ["critical", "major", "minor", "advisory"];
const PRI: DeficiencyPriority[] = ["urgent", "high", "normal", "low"];
const STAT: DeficiencyStatus[] = ["open", "in_progress", "resolved", "wont_fix"];

export async function createDeficiencyAction(_prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const title = asString(form, "title");
  const site_id = asString(form, "site_id");
  if (!title) return { ok: false, error: "Title is required." };
  if (!site_id) return { ok: false, error: "Site is required." };

  const severity = (asString(form, "severity") || "minor") as DeficiencySeverity;
  const priority = (asString(form, "priority") || "normal") as DeficiencyPriority;
  if (!SEV.includes(severity) || !PRI.includes(priority)) {
    return { ok: false, error: "Invalid severity or priority." };
  }

  const { data, error } = await supa()
    .from("deficiencies")
    .insert({
      org_id: orgId,
      site_id,
      work_record_id: asOptional(form, "work_record_id"),
      asset_id: asOptional(form, "asset_id"),
      severity,
      priority,
      status: "open",
      title,
      description: asOptional(form, "description"),
      code_reference: asOptional(form, "code_reference"),
      recommended_action: asOptional(form, "recommended_action"),
      due_date: asOptional(form, "due_date"),
      assigned_to: asOptional(form, "assigned_to"),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create deficiency." };

  await audit({
    orgId,
    action: "create",
    targetTable: "deficiencies",
    targetId: data.id,
    payload: { title, severity, priority },
  });
  revalidatePath("/deficiencies");
  redirect(`/deficiencies/${data.id}`);
}

export async function updateDeficiencyAction(id: string, _prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const title = asString(form, "title");
  if (!title) return { ok: false, error: "Title is required." };

  const severity = (asString(form, "severity") || "minor") as DeficiencySeverity;
  const priority = (asString(form, "priority") || "normal") as DeficiencyPriority;

  const { error } = await supa()
    .from("deficiencies")
    .update({
      title,
      description: asOptional(form, "description"),
      severity,
      priority,
      code_reference: asOptional(form, "code_reference"),
      recommended_action: asOptional(form, "recommended_action"),
      due_date: asOptional(form, "due_date"),
      assigned_to: asOptional(form, "assigned_to"),
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  await audit({ orgId, action: "update", targetTable: "deficiencies", targetId: id });
  revalidatePath("/deficiencies");
  revalidatePath(`/deficiencies/${id}`);
  redirect(`/deficiencies/${id}`);
}

export async function changeDeficiencyStatusAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "") as DeficiencyStatus;
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !STAT.includes(to)) return;

  const { data: current } = await supa()
    .from("deficiencies")
    .select("status")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  const from = current?.status ?? null;

  await supa()
    .from("deficiencies")
    .update({
      status: to,
      resolved_on: to === "resolved" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  await supa().from("deficiency_updates").insert({
    org_id: orgId,
    deficiency_id: id,
    body: body || `Status changed to ${to.replace("_", " ")}.`,
    from_status: from,
    to_status: to,
  });

  await audit({
    orgId,
    action: "status_change",
    targetTable: "deficiencies",
    targetId: id,
    payload: { from, to },
  });
  revalidatePath(`/deficiencies/${id}`);
  revalidatePath("/deficiencies");
}

export async function addDeficiencyUpdateAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !body) return;

  await supa().from("deficiency_updates").insert({
    org_id: orgId,
    deficiency_id: id,
    body,
  });
  await audit({
    orgId,
    action: "comment",
    targetTable: "deficiencies",
    targetId: id,
  });
  revalidatePath(`/deficiencies/${id}`);
}
