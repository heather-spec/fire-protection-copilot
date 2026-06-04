"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/db/audit";
import type { WorkRecordType } from "@/lib/db/types";
import {
  ActionResult,
  asOptional,
  asString,
  requireOrg,
  supa,
} from "./_shared";

const VALID_TYPES: WorkRecordType[] = [
  "inspection",
  "test",
  "maintenance",
  "service_call",
  "deficiency_followup",
  "impairment",
  "fire_watch",
];

function buildMetadata(form: FormData, type: WorkRecordType): Record<string, unknown> {
  // Type-specific metadata captured by the adaptive form
  const md: Record<string, unknown> = {};
  switch (type) {
    case "service_call":
      md.issue_reported = asOptional(form, "md_issue_reported");
      md.action_taken = asOptional(form, "md_action_taken");
      md.parts_used = asOptional(form, "md_parts_used");
      md.resolution = asOptional(form, "md_resolution");
      break;
    case "deficiency_followup":
      md.addressed = asOptional(form, "md_addressed");
      md.result = asOptional(form, "md_result");
      md.remaining = asOptional(form, "md_remaining");
      break;
    case "impairment": {
      md.impairment_type = asOptional(form, "md_impairment_type") ?? "planned";
      md.system_out = asOptional(form, "md_system_out");
      md.start = asOptional(form, "md_start");
      md.expected_end = asOptional(form, "md_expected_end");
      md.mitigation_steps = asOptional(form, "md_mitigation_steps");
      md.ahj_notified = !!asOptional(form, "md_ahj_notified");
      break;
    }
    case "fire_watch":
      md.interval_minutes = Number(asOptional(form, "md_interval_minutes") ?? "60");
      md.related_impairment = asOptional(form, "md_related_impairment");
      md.rounds_logged = Number(asOptional(form, "md_rounds_logged") ?? "0");
      md.incidents = asOptional(form, "md_incidents");
      break;
  }
  return md;
}

export async function createWorkRecordAction(_prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId, user } = await requireOrg();
  const customer_id = asString(form, "customer_id");
  const site_id = asString(form, "site_id");
  const record_type = asString(form, "record_type") as WorkRecordType;
  if (!customer_id || !site_id) return { ok: false, error: "Customer and site are required." };
  if (!VALID_TYPES.includes(record_type)) return { ok: false, error: "Visit type is invalid." };

  const reference = await generateReference(orgId, record_type);

  const { data, error } = await supa()
    .from("work_records")
    .insert({
      org_id: orgId,
      customer_id,
      site_id,
      record_type,
      status: "draft",
      reference_code: reference,
      technician_id: user.id,
      scheduled_for: asOptional(form, "scheduled_for"),
      summary: asOptional(form, "summary"),
      notes: asOptional(form, "notes"),
      voice_transcript: asOptional(form, "voice_transcript"),
      metadata: buildMetadata(form, record_type),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create work record." };

  await audit({
    orgId,
    action: "create",
    targetTable: "work_records",
    targetId: data.id,
    payload: { record_type, reference_code: reference },
  });

  revalidatePath("/work-records");
  redirect(`/work-records/${data.id}`);
}

export async function updateWorkRecordAction(id: string, _prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const record_type = asString(form, "record_type") as WorkRecordType;
  if (!VALID_TYPES.includes(record_type)) return { ok: false, error: "Visit type is invalid." };

  const { error } = await supa()
    .from("work_records")
    .update({
      summary: asOptional(form, "summary"),
      notes: asOptional(form, "notes"),
      voice_transcript: asOptional(form, "voice_transcript"),
      scheduled_for: asOptional(form, "scheduled_for"),
      completed_at: asOptional(form, "completed_at"),
      metadata: buildMetadata(form, record_type),
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  await audit({ orgId, action: "update", targetTable: "work_records", targetId: id });
  revalidatePath(`/work-records/${id}`);
  redirect(`/work-records/${id}`);
}

export async function addObservationAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const work_record_id = String(formData.get("work_record_id") ?? "");
  const description = asString(formData, "description");
  if (!work_record_id || !description) return;

  await supa().from("work_record_observations").insert({
    org_id: orgId,
    work_record_id,
    asset_id: asOptional(formData, "asset_id"),
    check_code: asOptional(formData, "check_code"),
    description,
    result: asOptional(formData, "result") ?? "pass",
    notes: asOptional(formData, "notes"),
  });

  await audit({
    orgId,
    action: "create",
    targetTable: "work_record_observations",
    targetId: work_record_id,
    payload: { description },
  });
  revalidatePath(`/work-records/${work_record_id}`);
}

export async function removeObservationAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const work_record_id = String(formData.get("work_record_id") ?? "");
  if (!id) return;
  await supa().from("work_record_observations").delete().eq("id", id).eq("org_id", orgId);
  await audit({ orgId, action: "delete", targetTable: "work_record_observations", targetId: id });
  if (work_record_id) revalidatePath(`/work-records/${work_record_id}`);
}

// --- Workflow transitions ---

export async function submitWorkRecordAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supa()
    .from("work_records")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);
  await audit({
    orgId,
    action: "submit",
    targetTable: "work_records",
    targetId: id,
    payload: { to_status: "submitted" },
  });
  revalidatePath(`/work-records/${id}`);
  revalidatePath("/work-records");
  redirect(`/work-records/${id}`);
}

export async function approveWorkRecordAction(formData: FormData): Promise<void> {
  const { orgId, user, role } = await requireOrg();
  if (!["admin", "reviewer"].includes(role)) throw new Error("forbidden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // bump version + write the finalized report_version row
  const { data: current } = await supa()
    .from("work_records")
    .select("final_report, final_report_version, summary")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  const content = current?.final_report ?? current?.summary ?? "";
  const nextVersion = (current?.final_report_version ?? 0) + 1;

  if (content.trim()) {
    await supa().from("report_versions").insert({
      org_id: orgId,
      work_record_id: id,
      version: nextVersion,
      kind: "finalized",
      content,
      author_id: user.id,
    });
  }

  await supa()
    .from("work_records")
    .update({
      status: "approved",
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
      final_report_version: nextVersion,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  await audit({
    orgId,
    action: "approve",
    targetTable: "work_records",
    targetId: id,
    payload: { version: nextVersion },
  });
  revalidatePath(`/work-records/${id}`);
  revalidatePath("/work-records");
  revalidatePath("/reports");
  redirect(`/work-records/${id}`);
}

export async function rejectWorkRecordAction(formData: FormData): Promise<void> {
  const { orgId, user, role } = await requireOrg();
  if (!["admin", "reviewer"].includes(role)) throw new Error("forbidden");
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return;

  await supa()
    .from("work_records")
    .update({
      status: "rejected",
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  await audit({
    orgId,
    action: "reject",
    targetTable: "work_records",
    targetId: id,
    payload: { reason },
  });
  revalidatePath(`/work-records/${id}`);
  revalidatePath("/work-records");
  redirect(`/work-records/${id}`);
}

export async function requestRevisionAction(formData: FormData): Promise<void> {
  const { orgId, user, role } = await requireOrg();
  if (!["admin", "reviewer"].includes(role)) throw new Error("forbidden");
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return;

  await supa()
    .from("work_records")
    .update({
      status: "revision_requested",
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  await audit({
    orgId,
    action: "request_revision",
    targetTable: "work_records",
    targetId: id,
    payload: { reason },
  });
  revalidatePath(`/work-records/${id}`);
  revalidatePath("/work-records");
  redirect(`/work-records/${id}`);
}

export async function saveFinalReportAction(formData: FormData): Promise<void> {
  const { orgId, user, role } = await requireOrg();
  if (!["admin", "reviewer"].includes(role)) throw new Error("forbidden");
  const id = String(formData.get("id") ?? "");
  const content = String(formData.get("final_report") ?? "");
  if (!id) return;

  const { data: current } = await supa()
    .from("work_records")
    .select("final_report_version")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  const nextVersion = (current?.final_report_version ?? 0) + 1;

  await supa().from("report_versions").insert({
    org_id: orgId,
    work_record_id: id,
    version: nextVersion,
    kind: "reviewer_edit",
    content,
    author_id: user.id,
  });

  await supa()
    .from("work_records")
    .update({
      final_report: content,
      final_report_version: nextVersion,
      status: "in_review",
    })
    .eq("id", id)
    .eq("org_id", orgId);

  await audit({
    orgId,
    action: "edit_report",
    targetTable: "work_records",
    targetId: id,
    payload: { version: nextVersion },
  });
  revalidatePath(`/work-records/${id}`);
}

// --- helpers ---

async function generateReference(orgId: string, type: WorkRecordType): Promise<string> {
  const prefix: Record<WorkRecordType, string> = {
    inspection: "INSP",
    test: "TEST",
    maintenance: "MAINT",
    service_call: "SVC",
    deficiency_followup: "DFU",
    impairment: "IMP",
    fire_watch: "FW",
  };
  const year = new Date().getFullYear();
  const start = new Date(`${year}-01-01T00:00:00Z`).toISOString();

  const { count } = await supa()
    .from("work_records")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("record_type", type)
    .gte("created_at", start);

  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `${prefix[type]}-${year}-${seq}`;
}
