/**
 * Rule implementations for the completeness checker.
 *
 * Each rule is a small pure function so it can be unit-tested in
 * isolation if needed. The main checker (./checker.ts) walks the
 * schema fields and dispatches to these by category/data_type.
 *
 * Source contract: schema/_contract.md — "Required-Field Logic for
 * Agent D". Do not invent rules; everything here mirrors the contract.
 */

import type {
  CheckCompletenessInput,
  CompletenessIssue,
  InspectionFormFieldLike,
} from "./types";

/**
 * Triplet results live in the work_record_observations.result column.
 * We accept the contract's canonical lowercase values plus the
 * "pass"/"fail" pair that some forms (e.g., backflow PASSED/FAILED)
 * fold into the same column.
 */
const TRIPLET_VALUES = new Set(["yes", "na", "n/a", "no", "pass", "fail"]);

const STALE_COPY_THRESHOLD_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ----------------------------- helpers ----------------------------- */

function isPresent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return Boolean(v);
}

function getHeaderValue(
  workRecord: CheckCompletenessInput["workRecord"],
  fieldName: string,
): unknown {
  const md = (workRecord.metadata ?? {}) as Record<string, unknown>;
  const direct = md[fieldName];
  if (isPresent(direct)) return direct;
  const st = md["servicetrade"] as Record<string, unknown> | undefined;
  if (st && isPresent(st[fieldName])) return st[fieldName];
  const header = md["header"] as Record<string, unknown> | undefined;
  if (header && isPresent(header[fieldName])) return header[fieldName];
  return undefined;
}

function getSignatureValue(
  workRecord: CheckCompletenessInput["workRecord"],
  fieldName: string,
): unknown {
  const md = (workRecord.metadata ?? {}) as Record<string, unknown>;
  const sigs = md["signatures"];
  if (Array.isArray(sigs)) {
    // Either an array of {field_name, value} or an array of strings keyed
    // by index. We accept both shapes — populated array counts as filled
    // when the field name matches OR when any signature exists for a
    // single-signature form.
    for (const s of sigs) {
      if (typeof s === "object" && s !== null) {
        const o = s as Record<string, unknown>;
        if (o["field_name"] === fieldName && isPresent(o["value"])) return o["value"];
      }
    }
    if (sigs.length > 0 && !sigs.some((s) => typeof s === "object")) return sigs[0];
  }
  return getHeaderValue(workRecord, fieldName);
}

/* --------------------------- rule: required ---------------------------- */

/**
 * Check a field marked required: true. Returns an issue if the field
 * has no value in its expected source. Triplet/asset/reading fields
 * are handled by dedicated rules below; this only covers the simple
 * present/absent shapes.
 */
export function checkMissingRequired(
  field: InspectionFormFieldLike,
  input: CheckCompletenessInput,
): CompletenessIssue | null {
  if (!field.required) return null;
  // Dedicated rules below cover these categories.
  if (field.data_type === "triplet") return null;
  if (field.category === "asset") return null;
  if (field.category === "reading") return null;

  let value: unknown;
  if (field.category === "header") {
    value = getHeaderValue(input.workRecord, field.name);
  } else if (field.category === "signature") {
    value = getSignatureValue(input.workRecord, field.name);
  } else if (field.category === "checkbox") {
    // Checkboxes are stored as observation rows whose check_code matches
    // the field name (per Agent B's contract mapping). Any non-empty
    // result satisfies "required" — pass/fail/na are all answers.
    const obs = input.observations.find((o) => o.check_code === field.name);
    value = obs && isPresent(obs.result) ? obs.result : undefined;
  } else if (field.category === "observation") {
    const obs = input.observations.find((o) => o.check_code === field.name);
    value = obs && isPresent(obs.result) ? obs.result : undefined;
  }

  if (isPresent(value)) return null;
  return {
    severity: "error",
    rule: "missing_required",
    field_name: field.name,
    field_label: field.label,
    group: field.group ?? undefined,
    message: `${field.label} is required but was not filled in.`,
  };
}

/* --------------------------- rule: triplet ----------------------------- */

/**
 * Returns the observation rows whose check_code matches a triplet
 * field. Multiple rows mean the form recorded conflicting answers,
 * which the contract treats as "inconsistent".
 */
function findTripletAnswers(
  field: InspectionFormFieldLike,
  input: CheckCompletenessInput,
): string[] {
  const matches = input.observations
    .filter((o) => o.check_code === field.name && isPresent(o.result))
    .map((o) => o.result.toLowerCase());
  // De-duplicate: a result of "yes" recorded twice isn't conflicting.
  const distinct = Array.from(new Set(matches.filter((r) => TRIPLET_VALUES.has(r))));
  // If multiple "yes"/"no"/"na" answers were recorded as separate rows,
  // each distinct value counts — that's the inconsistency.
  return distinct;
}

export function checkTriplet(
  field: InspectionFormFieldLike,
  input: CheckCompletenessInput,
): CompletenessIssue | null {
  if (field.data_type !== "triplet") return null;
  const answers = findTripletAnswers(field, input);

  if (answers.length === 0) {
    if (!field.required) return null;
    return {
      severity: "error",
      rule: "triplet_unanswered",
      field_name: field.name,
      field_label: field.label,
      group: field.group ?? undefined,
      message: `${field.label} has no YES/N/A/NO answer selected.`,
    };
  }

  if (answers.length > 1) {
    return {
      severity: "error",
      rule: "triplet_multiple",
      field_name: field.name,
      field_label: field.label,
      group: field.group ?? undefined,
      message: `${field.label} has multiple conflicting answers: ${answers.join(", ")}.`,
    };
  }

  return null;
}

/* ----------------------------- rule: asset ----------------------------- */

/**
 * Asset rows are populated/empty rather than individually required.
 * Per contract: a row counts only when at least one of model, serial
 * number, or asset_name (we treat `identifier` as asset_name on the
 * Asset row) is populated. An empty row is flagged as a warning so
 * the inspector can decide whether to fill or remove it, but it does
 * not count toward required_complete.
 */
export function checkAssets(
  schemaAssetFields: InspectionFormFieldLike[],
  input: CheckCompletenessInput,
): { issues: CompletenessIssue[]; requiredComplete: number; requiredTotal: number } {
  const issues: CompletenessIssue[] = [];
  let requiredComplete = 0;
  let requiredTotal = 0;

  // Group the schema asset fields by asset_role so we can ask "is there
  // a populated row for this role?" once per role rather than per field.
  const rolesOnSchema = new Set(
    schemaAssetFields.map((f) => f.asset_role).filter((r): r is string => Boolean(r)),
  );

  for (const role of rolesOnSchema) {
    const fieldsForRole = schemaAssetFields.filter((f) => f.asset_role === role);
    const required = fieldsForRole.some((f) => f.required);
    if (required) requiredTotal += 1;

    // A row "exists" if any asset row was captured whose asset_type
    // matches this role. We treat asset_type and asset_role as
    // interchangeable for the purposes of completeness — Agent B's
    // mapping turns one into the other.
    const matchingAssets = input.assets.filter(
      (a) => a.asset_type === role || a.asset_type === role.toLowerCase(),
    );

    if (matchingAssets.length === 0) {
      if (required) {
        issues.push({
          severity: "error",
          rule: "missing_required",
          field_label: role,
          group: fieldsForRole[0]?.group ?? undefined,
          message: `No ${role} asset row was captured.`,
        });
      }
      continue;
    }

    const populated = matchingAssets.filter(
      (a) => isPresent(a.model) || isPresent(a.serial_number) || isPresent(a.identifier),
    );

    if (populated.length === 0) {
      // Row(s) exist but every one is empty. Flag — don't count.
      issues.push({
        severity: "warning",
        rule: "asset_empty",
        field_label: role,
        group: fieldsForRole[0]?.group ?? undefined,
        message: `${role} row was created but no model, serial number, or identifier was recorded.`,
      });
      continue;
    }

    if (required) requiredComplete += 1;
  }

  return { issues, requiredComplete, requiredTotal };
}

/* --------------------------- rule: readings ---------------------------- */

/**
 * The high-signal rule. Within each (group_key) bucket, once ANY
 * reading has a value, ALL readings on that bucket must have values.
 * This catches the "Mike forgot a flow-test reading" case from the
 * discovery day notes.
 *
 * Required readings outside a group are also counted toward
 * required_complete here so the summary numbers stay consistent.
 */
export function checkReadings(
  schemaReadingFields: InspectionFormFieldLike[],
  input: CheckCompletenessInput,
): { issues: CompletenessIssue[]; requiredComplete: number; requiredTotal: number } {
  const issues: CompletenessIssue[] = [];
  let requiredComplete = 0;
  let requiredTotal = 0;

  // Map readings by field_name for O(1) lookup, and bucket by group_key
  // for the partial-row rule.
  const readingByField = new Map<string, (typeof input.readings)[number]>();
  for (const r of input.readings) {
    readingByField.set(r.field_name, r);
  }

  // Required-reading accounting (independent of group-partial rule).
  for (const f of schemaReadingFields) {
    if (!f.required) continue;
    requiredTotal += 1;
    const r = readingByField.get(f.name);
    if (r && (isPresent(r.value_numeric) || isPresent(r.value_text))) {
      requiredComplete += 1;
    } else {
      issues.push({
        severity: "error",
        rule: "missing_required",
        field_name: f.name,
        field_label: f.label,
        group: f.group ?? undefined,
        message: `${f.label} reading is required but was not recorded.`,
      });
    }
  }

  // Group-partial rule. Group the schema's reading fields by group, then
  // for each group check whether the inspector started filling values
  // and missed some.
  const groups = new Map<string, InspectionFormFieldLike[]>();
  for (const f of schemaReadingFields) {
    const key = f.group ?? "__ungrouped__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  for (const [groupKey, fields] of groups) {
    if (groupKey === "__ungrouped__") continue;

    // Collect the readings that actually landed in this group, either
    // by their group_key column or by matching field_name to a schema
    // field in this group (some seeders won't set group_key).
    const fieldNames = new Set(fields.map((f) => f.name));
    const rowsInGroup = input.readings.filter(
      (r) => r.group_key === groupKey || fieldNames.has(r.field_name),
    );

    const anyFilled = rowsInGroup.some(
      (r) => isPresent(r.value_numeric) || isPresent(r.value_text),
    );
    if (!anyFilled) continue;

    for (const f of fields) {
      const r = readingByField.get(f.name);
      const filled = r && (isPresent(r.value_numeric) || isPresent(r.value_text));
      if (filled) continue;
      // Don't double-count: if we already emitted a missing_required for
      // this field above, skip the partial-row issue.
      const alreadyFlagged = issues.some(
        (i) => i.rule === "missing_required" && i.field_name === f.name,
      );
      if (alreadyFlagged) continue;
      issues.push({
        severity: "error",
        rule: "reading_partial",
        field_name: f.name,
        field_label: f.label,
        group: groupKey,
        message: `${f.label} is missing — other readings in ${groupKey} were filled, so this row is incomplete.`,
      });
    }
  }

  return { issues, requiredComplete, requiredTotal };
}

/* --------------------------- rule: stale copy -------------------------- */

/**
 * Parse a date out of one of the conventional header slots and warn
 * if it's more than 90 days before `now`. We try the canonical
 * servicetrade_job_dates first, then fall back to legacy header.DATE
 * or workRecord.metadata.header.date.
 */
export function checkStaleCopy(
  input: CheckCompletenessInput,
): CompletenessIssue | null {
  const md = (input.workRecord.metadata ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [];

  const st = md["servicetrade"] as Record<string, unknown> | undefined;
  if (st) {
    candidates.push(st["servicetrade_job_dates"]);
    candidates.push(st["DATE"]);
    candidates.push(st["date"]);
  }
  const header = md["header"] as Record<string, unknown> | undefined;
  if (header) {
    candidates.push(header["servicetrade_job_dates"]);
    candidates.push(header["DATE"]);
    candidates.push(header["date"]);
  }
  candidates.push(md["DATE"]);
  candidates.push(md["servicetrade_job_dates"]);

  const now = input.now ?? new Date();
  for (const c of candidates) {
    if (typeof c !== "string" || c.trim() === "") continue;
    const parsed = Date.parse(c);
    if (Number.isNaN(parsed)) continue;
    const ageDays = (now.getTime() - parsed) / MS_PER_DAY;
    if (ageDays > STALE_COPY_THRESHOLD_DAYS) {
      return {
        severity: "warning",
        rule: "stale_copy_suspect",
        field_label: "Header date",
        group: "header",
        message: `Header date is ${Math.floor(ageDays)} days old — verify this isn't a stale copy.`,
      };
    }
    return null;
  }
  return null;
}
