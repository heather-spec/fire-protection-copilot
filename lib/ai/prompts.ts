import type { WorkRecordType } from "@/lib/db/types";
import { titleCase } from "@/lib/utils/format";

/**
 * Prompt templates for AI-assisted drafting.
 *
 * Hard rules every template enforces:
 *   1. NEVER invent NFPA codes, dates, manufacturer names, or values
 *      that do not appear in the source inputs.
 *   2. If source data is insufficient, say so explicitly.
 *   3. Always label the output as a DRAFT and remind the reviewer to verify.
 *   4. Keep source data SEPARATE from generated narrative — output is
 *      narrative only; raw inputs are stored on the work record itself.
 */

const HARD_RULES = `
You are a drafting assistant for a fire protection contractor's compliance platform.

Rules you MUST follow:
- Use only facts that appear in the provided source inputs.
- Never invent NFPA codes, dates, model numbers, manufacturer names, values, signatures, or measurements.
- Never invent local jurisdiction code citations (e.g. Ohio Fire Code §, KY Standards of Safety §). If a local citation
  appears in the inputs (see "Local code amendments" if provided), you may quote it. Otherwise cite only the
  source NFPA reference that the technician recorded.
- If a needed fact is missing, say "Information not provided" rather than guessing.
- When a jurisdiction is specified, mention it in the opening sentence so the report is unambiguous
  about which AHJ's adopted edition applies.
- Begin every draft with the literal text "DRAFT — generated from technician inputs. Reviewer must verify before finalizing."
- Write in clear, neutral, operational English. Avoid marketing tone.
- Do not include legal disclaimers, customer pricing, or invoicing language.
- Do not address the customer directly. Write in third person.
`.trim();

export interface JurisdictionContext {
  name: string;                                // "Cincinnati Fire Department"
  state: string;                               // "OH"
  adoptedCode: string | null;                  // "Ohio Fire Code 2021"
  nfpaEditions: Record<string, string>;        // { "NFPA 25": "2020" }
  amendments?: Array<{
    sourceRef: string;
    localRef: string | null;
    frequencyOverride: string | null;
    description: string | null;
  }>;
}

export interface SourceInputs {
  visitType: WorkRecordType;
  referenceCode: string | null;
  customerName: string;
  siteName: string;
  technicianName: string | null;
  completedAt: string | null;
  summary: string | null;
  notes: string | null;
  voiceTranscript: string | null;
  jurisdiction: JurisdictionContext | null;
  observations: Array<{
    description: string;
    result: string;
    code: string | null;
    notes: string | null;
  }>;
}

function renderSourceBlock(inp: SourceInputs): string {
  const lines: string[] = [];
  lines.push(`Visit type: ${titleCase(inp.visitType)}`);
  if (inp.referenceCode) lines.push(`Reference: ${inp.referenceCode}`);
  lines.push(`Customer: ${inp.customerName}`);
  lines.push(`Site: ${inp.siteName}`);
  if (inp.technicianName) lines.push(`Technician: ${inp.technicianName}`);
  if (inp.completedAt) lines.push(`Completed: ${inp.completedAt}`);

  if (inp.jurisdiction) {
    const j = inp.jurisdiction;
    lines.push(`Jurisdiction: ${j.name} (${j.state})`);
    if (j.adoptedCode) lines.push(`Adopted code: ${j.adoptedCode}`);
    const editions = Object.entries(j.nfpaEditions || {});
    if (editions.length > 0) {
      lines.push(
        `Adopted editions: ${editions.map(([k, v]) => `${k}=${v}`).join(", ")}`,
      );
    }
    if (j.amendments && j.amendments.length > 0) {
      lines.push("Local code amendments (apply when source NFPA ref matches):");
      for (const a of j.amendments) {
        const freq = a.frequencyOverride ? `, freq=${a.frequencyOverride}` : "";
        lines.push(
          `- ${a.sourceRef} → ${a.localRef ?? "(local equivalent unspecified)"}${freq}${a.description ? ` — ${a.description}` : ""}`,
        );
      }
    }
  }

  if (inp.summary) {
    lines.push(`Summary: ${inp.summary}`);
  }

  if (inp.observations.length > 0) {
    lines.push(`Observations (${inp.observations.length}):`);
    for (const obs of inp.observations) {
      const code = obs.code ? `[${obs.code}] ` : "";
      const note = obs.notes ? ` — ${obs.notes}` : "";
      lines.push(`- ${code}${obs.description} — result: ${obs.result}${note}`);
    }
  } else {
    lines.push("Observations: (none recorded)");
  }

  lines.push(`Technician notes: ${inp.notes && inp.notes.trim() ? inp.notes : "(none)"}`);
  if (inp.voiceTranscript && inp.voiceTranscript.trim()) {
    lines.push(`Voice transcript: ${inp.voiceTranscript}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------

export function reportDraftPrompt(inp: SourceInputs) {
  const userPrompt = [
    "Generate a compliance report draft from the following source inputs.",
    "",
    "Structure: 1) one-paragraph summary; 2) observations grouped by result (passed / failed / N-A);",
    "3) follow-up items if any failing observations exist; 4) a closing line noting that NFPA citations should be added by the reviewer where applicable.",
    "",
    "Source inputs:",
    renderSourceBlock(inp),
  ].join("\n");
  return { systemPrompt: HARD_RULES, userPrompt };
}

export function clientSummaryPrompt(inp: SourceInputs) {
  const userPrompt = [
    "Write a short, customer-friendly summary (4-6 sentences) of the visit using only the facts below.",
    "Audience: facilities manager at the customer site. Tone: professional, neutral. Do not include pricing.",
    "If any failing observations exist, mention that follow-up will be required but do not invent NFPA citations.",
    "",
    "Source inputs:",
    renderSourceBlock(inp),
  ].join("\n");
  return { systemPrompt: HARD_RULES, userPrompt };
}

export interface DeficiencyExtraction {
  title: string;
  description: string;
  severity: "critical" | "major" | "minor" | "advisory";
  recommended_action: string;
  source_observation?: string;
}

export function deficiencyExtractionPrompt(inp: SourceInputs) {
  const userPrompt = [
    "From the source inputs below, identify any failed or deficient observations and propose deficiency entries.",
    "",
    "Output STRICT JSON only — an array of objects with these keys:",
    `[{ "title": string, "description": string, "severity": "critical"|"major"|"minor"|"advisory", "recommended_action": string, "source_observation": string }]`,
    "",
    "Rules:",
    '- Only include items whose observation result clearly indicates failure (e.g., "fail", "trouble", "deficient").',
    "- Severity must be chosen from {critical, major, minor, advisory}. Use 'critical' only if the input itself indicates life-safety impact.",
    "- recommended_action must be specific to what was observed; if no action is implied by the source, write \"Reviewer to recommend action.\"",
    "- If no failing observations exist, return an empty JSON array: []",
    "- Do not invent NFPA codes or values.",
    "",
    "Source inputs:",
    renderSourceBlock(inp),
  ].join("\n");
  return { systemPrompt: HARD_RULES, userPrompt };
}

export function safeParseDeficiencyJson(raw: string): DeficiencyExtraction[] {
  // Some models wrap JSON in markdown fences. Strip them defensively.
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is DeficiencyExtraction =>
        x &&
        typeof x.title === "string" &&
        typeof x.description === "string" &&
        ["critical", "major", "minor", "advisory"].includes(x.severity) &&
        typeof x.recommended_action === "string",
    );
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------- */
/* Desk demo: PDF completeness + bounce-back note                       */
/* -------------------------------------------------------------------- */

export interface PdfCompletenessInputs {
  formName: string;
  requiredFields: string[];
  /** field name -> extracted value ("" means blank on the report) */
  reportFields: Record<string, string>;
}

export function pdfCompletenessPrompt(inp: PdfCompletenessInputs) {
  const fieldDump = Object.entries(inp.reportFields)
    .map(([k, v]) => `- ${k}: ${v.trim() === "" ? "(blank)" : v.trim()}`)
    .join("\n");
  const userPrompt = [
    `You are reviewing a completed "${inp.formName}" fire-protection inspection report.`,
    `These readings are REQUIRED for this report to be complete:`,
    inp.requiredFields.map((f) => `- ${f}`).join("\n"),
    ``,
    `Here is every field captured on the report and its value:`,
    fieldDump || "(no extractable fields)",
    ``,
    `Decide which REQUIRED readings are missing or blank. Match required readings`,
    `to report fields by meaning, not exact string (e.g. "Suction Pressure" may`,
    `appear as "Suction PSI"). A field present but blank counts as missing.`,
    ``,
    `Output STRICT JSON only, no prose, this exact shape:`,
    `{ "missing": [ { "field": string, "reason": string } ], "satisfied_count": number }`,
    `where satisfied_count is how many of the ${inp.requiredFields.length} required`,
    `readings are present and non-blank. If everything is present, "missing" is [].`,
  ].join("\n");
  const systemPrompt =
    "You are a meticulous fire-protection report reviewer. Report only what the " +
    "data shows. Never invent values or NFPA codes. Output JSON only.";
  return { systemPrompt, userPrompt };
}

export interface BounceNoteInputs {
  formName: string;
  customer: string;
  missing: Array<{ field: string; reason: string }>;
}

export function bounceNotePrompt(inp: BounceNoteInputs) {
  const userPrompt = [
    `Write a short, friendly note to the field technician asking them to complete`,
    `their "${inp.formName}" report for ${inp.customer}. List exactly what is missing:`,
    inp.missing.map((m) => `- ${m.field}`).join("\n"),
    ``,
    `Two or three sentences. Specific, not preachy. No greeting block, no signature.`,
  ].join("\n");
  const systemPrompt =
    "You write brief, plain, respectful internal messages for a fire-protection " +
    "contractor's back office. No marketing tone.";
  return { systemPrompt, userPrompt };
}

export function safeParseCompletenessJson(
  raw: string,
): { missing: Array<{ field: string; reason: string }>; satisfied_count: number } | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || !Array.isArray(parsed.missing)) return null;
    const missing = parsed.missing
      .filter((m: unknown): m is { field: string; reason: string } =>
        !!m && typeof (m as { field?: unknown }).field === "string")
      .map((m: { field: string; reason?: string }) => ({
        field: m.field,
        reason: typeof m.reason === "string" ? m.reason : "",
      }));
    const satisfied_count =
      typeof parsed.satisfied_count === "number" ? parsed.satisfied_count : 0;
    return { missing, satisfied_count };
  } catch {
    return null;
  }
}
