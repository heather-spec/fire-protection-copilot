"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/db/audit";
import { getAiProvider } from "@/lib/ai/provider";
import {
  clientSummaryPrompt,
  deficiencyExtractionPrompt,
  reportDraftPrompt,
  safeParseDeficiencyJson,
  type SourceInputs,
} from "@/lib/ai/prompts";
import { requireOrg, supa } from "./_shared";

async function loadSourceInputs(orgId: string, workRecordId: string): Promise<SourceInputs | null> {
  const { data: r } = await supa()
    .from("work_records")
    .select(`
      record_type, reference_code, summary, notes, voice_transcript, completed_at,
      customer:customers(name),
      site:sites(name),
      technician:profiles!work_records_technician_id_fkey(full_name)
    `)
    .eq("id", workRecordId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!r) return null;

  const { data: obs } = await supa()
    .from("work_record_observations")
    .select("description, result, check_code, notes")
    .eq("work_record_id", workRecordId)
    .order("created_at", { ascending: true });

  return {
    visitType: r.record_type,
    referenceCode: r.reference_code,
    customerName:
      (r.customer as unknown as { name: string } | null)?.name ?? "(unknown customer)",
    siteName: (r.site as unknown as { name: string } | null)?.name ?? "(unknown site)",
    technicianName:
      (r.technician as unknown as { full_name: string } | null)?.full_name ?? null,
    completedAt: r.completed_at,
    summary: r.summary,
    notes: r.notes,
    voiceTranscript: r.voice_transcript,
    observations: (obs ?? []).map((o: {
      description: string; result: string; check_code: string | null; notes: string | null;
    }) => ({
      description: o.description,
      result: o.result,
      code: o.check_code,
      notes: o.notes,
    })),
  };
}

async function callAndLog(opts: {
  orgId: string;
  workRecordId: string;
  kind: "report_draft" | "client_summary" | "deficiency_extract";
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ output: string; generationId: string; provider: string; model: string }> {
  const provider = getAiProvider();
  const { data: u } = await supa().auth.getUser();

  let output = "";
  let status: "ok" | "error" = "ok";
  let error: string | null = null;

  try {
    const res = await provider.generate({
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
    });
    output = res.output;
  } catch (e) {
    status = "error";
    error = e instanceof Error ? e.message : String(e);
  }

  const { data } = await supa()
    .from("ai_generations")
    .insert({
      org_id: opts.orgId,
      target_table: "work_records",
      target_id: opts.workRecordId,
      kind: opts.kind,
      provider: provider.name,
      model: provider.defaultModel,
      prompt: opts.userPrompt,
      input_snapshot: { systemPromptHash: hash(opts.systemPrompt) },
      output,
      status,
      error,
      created_by: u.user?.id ?? null,
    })
    .select("id")
    .single();

  return {
    output,
    generationId: data?.id ?? "",
    provider: provider.name,
    model: provider.defaultModel,
  };
}

function hash(s: string): string {
  // tiny non-crypto hash for snapshot fingerprint
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(16);
}

// ---------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------

export async function generateReportDraftAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inputs = await loadSourceInputs(orgId, id);
  if (!inputs) return;

  const { systemPrompt, userPrompt } = reportDraftPrompt(inputs);
  const { output, generationId } = await callAndLog({
    orgId,
    workRecordId: id,
    kind: "report_draft",
    systemPrompt,
    userPrompt,
  });

  const { data: current } = await supa()
    .from("work_records")
    .select("final_report_version")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  const nextVersion = (current?.final_report_version ?? 0) + 1;

  const { data: version } = await supa()
    .from("report_versions")
    .insert({
      org_id: orgId,
      work_record_id: id,
      version: nextVersion,
      kind: "ai_draft",
      content: output,
      ai_generation_id: generationId || null,
    })
    .select("id")
    .single();

  await supa()
    .from("work_records")
    .update({
      latest_ai_draft_id: version?.id ?? null,
      final_report_version: nextVersion,
      final_report: output,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  await audit({
    orgId,
    action: "ai_generate",
    targetTable: "work_records",
    targetId: id,
    payload: { kind: "report_draft", version: nextVersion },
  });
  revalidatePath(`/work-records/${id}`);
}

export async function generateClientSummaryAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inputs = await loadSourceInputs(orgId, id);
  if (!inputs) return;

  const { systemPrompt, userPrompt } = clientSummaryPrompt(inputs);
  const { output } = await callAndLog({
    orgId,
    workRecordId: id,
    kind: "client_summary",
    systemPrompt,
    userPrompt,
  });

  const { data: rec } = await supa()
    .from("work_records")
    .select("metadata")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  const md = { ...(rec?.metadata ?? {}), client_summary: output };
  await supa().from("work_records").update({ metadata: md }).eq("id", id).eq("org_id", orgId);

  await audit({
    orgId,
    action: "ai_generate",
    targetTable: "work_records",
    targetId: id,
    payload: { kind: "client_summary" },
  });
  revalidatePath(`/work-records/${id}`);
}

export async function extractDeficienciesAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inputs = await loadSourceInputs(orgId, id);
  if (!inputs) return;

  const { systemPrompt, userPrompt } = deficiencyExtractionPrompt(inputs);
  const { output } = await callAndLog({
    orgId,
    workRecordId: id,
    kind: "deficiency_extract",
    systemPrompt,
    userPrompt,
  });

  const items = safeParseDeficiencyJson(output);
  if (items.length === 0) {
    revalidatePath(`/work-records/${id}`);
    return;
  }

  const { data: rec } = await supa()
    .from("work_records")
    .select("site_id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!rec) return;

  for (const item of items) {
    const { data } = await supa()
      .from("deficiencies")
      .insert({
        org_id: orgId,
        site_id: rec.site_id,
        work_record_id: id,
        severity: item.severity,
        priority: "normal",
        status: "open",
        title: item.title.slice(0, 200),
        description: item.description,
        recommended_action: item.recommended_action,
      })
      .select("id")
      .single();
    await audit({
      orgId,
      action: "ai_extract",
      targetTable: "deficiencies",
      targetId: data?.id ?? null,
      payload: { from_work_record: id },
    });
  }

  await audit({
    orgId,
    action: "ai_generate",
    targetTable: "work_records",
    targetId: id,
    payload: { kind: "deficiency_extract", created_count: items.length },
  });
  revalidatePath(`/work-records/${id}`);
  revalidatePath("/deficiencies");
}
