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
- If a needed fact is missing, say "Information not provided" rather than guessing.
- Begin every draft with the literal text "DRAFT — generated from technician inputs. Reviewer must verify before finalizing."
- Write in clear, neutral, operational English. Avoid marketing tone.
- Do not include legal disclaimers, customer pricing, or invoicing language.
- Do not address the customer directly. Write in third person.
`.trim();

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
