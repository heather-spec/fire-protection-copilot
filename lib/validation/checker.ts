/**
 * Schema-driven completeness checker for inspection work records.
 *
 * Agent D owns this module. The checker walks the InspectionFormSchema
 * (Agent A's output, stored on inspection_templates.schema_json) and
 * the record's captured data (header metadata, observations, readings,
 * assets) and returns a flat list of issues plus a summary.
 *
 * The rules implemented here mirror schema/_contract.md verbatim —
 * see ./rules.ts for the per-rule implementations.
 */

import type {
  CheckCompletenessInput,
  CompletenessIssue,
  CompletenessResult,
  InspectionFormFieldLike,
} from "./types";
import {
  checkAssets,
  checkMissingRequired,
  checkReadings,
  checkStaleCopy,
  checkTriplet,
} from "./rules";

export function checkCompleteness(input: CheckCompletenessInput): CompletenessResult {
  const issues: CompletenessIssue[] = [];
  let requiredComplete = 0;
  let requiredTotal = 0;

  const fields = input.schema.fields ?? [];

  // --- 1. Plain required + triplets + signatures/headers/checkboxes ---
  for (const field of fields) {
    // Triplets are evaluated independently; required-ness is part of the
    // triplet rule (an unanswered non-required triplet is fine).
    if (field.data_type === "triplet") {
      const issue = checkTriplet(field, input);
      if (issue) issues.push(issue);
      if (field.required) {
        requiredTotal += 1;
        if (!issue) requiredComplete += 1;
      }
      continue;
    }

    // Assets and readings are handled by their bulk rule below — they
    // need cross-field awareness.
    if (field.category === "asset") continue;
    if (field.category === "reading") continue;

    if (field.required) requiredTotal += 1;
    const missing = checkMissingRequired(field, input);
    if (missing) {
      issues.push(missing);
    } else if (field.required) {
      requiredComplete += 1;
    }
  }

  // --- 2. Asset rows (grouped by role) ---
  const assetFields = fields.filter((f: InspectionFormFieldLike) => f.category === "asset");
  if (assetFields.length > 0) {
    const a = checkAssets(assetFields, input);
    issues.push(...a.issues);
    requiredComplete += a.requiredComplete;
    requiredTotal += a.requiredTotal;
  }

  // --- 3. Readings (group-partial + required) ---
  const readingFields = fields.filter((f: InspectionFormFieldLike) => f.category === "reading");
  if (readingFields.length > 0) {
    const r = checkReadings(readingFields, input);
    issues.push(...r.issues);
    requiredComplete += r.requiredComplete;
    requiredTotal += r.requiredTotal;
  }

  // --- 4. Stale-copy warning ---
  const stale = checkStaleCopy(input);
  if (stale) issues.push(stale);

  // --- Summary ---
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return {
    ok: errors === 0,
    issues,
    summary: {
      errors,
      warnings,
      required_complete: requiredComplete,
      required_total: requiredTotal,
    },
  };
}

export type { CompletenessIssue, CompletenessResult } from "./types";
