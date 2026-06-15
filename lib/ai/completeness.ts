import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import type { CompletenessResult, CompletenessIssue } from "@/lib/validation/types";
import type { AiProvider } from "./types";
import { getAiProvider } from "./provider";
import { pdfCompletenessPrompt, safeParseCompletenessJson } from "./prompts";

/** Read an AcroForm's fields into a name -> string-value map. Blank = "". */
export async function extractAcroFields(bytes: Uint8Array): Promise<Record<string, string>> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const out: Record<string, string> = {};
  for (const field of form.getFields()) {
    const name = field.getName();
    if (field instanceof PDFTextField) {
      out[name] = field.getText() ?? "";
    } else if (field instanceof PDFCheckBox) {
      out[name] = field.isChecked() ? "checked" : "";
    } else if (field instanceof PDFDropdown) {
      out[name] = (field.getSelected()[0] ?? "");
    } else if (field instanceof PDFRadioGroup) {
      out[name] = field.getSelected() ?? "";
    } else {
      out[name] = "";
    }
  }
  return out;
}

export interface PdfCompletenessArgs {
  pdfBytes: Uint8Array;
  formName: string;
  requiredFields: string[];
}

/**
 * Live completeness check: extract the report's fields, ask Claude which
 * required readings are missing, and shape the answer into a CompletenessResult.
 * `provider` is injectable for tests; defaults to the configured provider.
 */
export async function checkPdfCompleteness(
  args: PdfCompletenessArgs,
  provider: AiProvider = getAiProvider(),
): Promise<CompletenessResult> {
  const reportFields = await extractAcroFields(args.pdfBytes);
  const { systemPrompt, userPrompt } = pdfCompletenessPrompt({
    formName: args.formName,
    requiredFields: args.requiredFields,
    reportFields,
  });

  const { output } = await provider.generate({ systemPrompt, userPrompt, maxTokens: 1024 });

  const parsed = safeParseCompletenessJson(output);
  const total = args.requiredFields.length;

  if (!parsed) {
    const issue: CompletenessIssue = {
      severity: "warning",
      rule: "stale_copy_suspect",
      message: "AI completeness check returned an unreadable response; review manually.",
      group: "ai_check",
    };
    return {
      ok: true,
      issues: [issue],
      summary: { errors: 0, warnings: 1, required_complete: total, required_total: total },
    };
  }

  const issues: CompletenessIssue[] = parsed.missing.map((m) => ({
    severity: "error",
    rule: "missing_required",
    field_name: m.field,
    field_label: m.field,
    group: "ai_check",
    message: m.reason || `${m.field} is missing or blank on the report.`,
  }));

  const complete = Math.max(0, Math.min(total, parsed.satisfied_count));
  return {
    ok: issues.length === 0,
    issues,
    summary: {
      errors: issues.length,
      warnings: 0,
      required_complete: complete,
      required_total: total,
    },
  };
}
