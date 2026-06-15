/**
 * Local types for the completeness checker (Agent D).
 *
 * The checker is schema-driven: it consumes the InspectionFormSchema
 * published in schema/_contract.md and an inspection record's data,
 * and emits a flat list of issues plus a summary counted against
 * the schema's required-field surface.
 *
 * Keep this file dependency-free so the rules module and tests can
 * import it without pulling in Supabase or React.
 */

export type Severity = "error" | "warning";

/**
 * The canonical rule keys. These are stable identifiers the UI
 * surfaces in badges and per-issue affordances; renaming them is a
 * breaking change for the CompletenessPanel.
 */
export type CompletenessRule =
  | "missing_required"
  | "triplet_unanswered"
  | "triplet_multiple"
  | "asset_empty"
  | "reading_partial"
  | "stale_copy_suspect";

export interface CompletenessIssue {
  severity: Severity;
  rule: CompletenessRule;
  field_name?: string;
  field_label?: string;
  group?: string;
  message: string;
}

export interface CompletenessResult {
  /** False if any error-severity issues are present. */
  ok: boolean;
  issues: CompletenessIssue[];
  summary: {
    errors: number;
    warnings: number;
    /** Count of required fields satisfied. */
    required_complete: number;
    /** Count of required fields on the schema. */
    required_total: number;
  };
}

/**
 * Inputs to the checker. Shaped to match the queries returned by
 * lib/db/queries.ts (getWorkRecord, listObservations,
 * listReadingsForRecord, listAssetsForSite) without importing the DB
 * types here — that keeps the validation module portable and easy to
 * unit test with plain literals.
 */
export interface CheckCompletenessInput {
  schema: InspectionFormSchemaLike;
  workRecord: {
    metadata?: Record<string, unknown> | null;
    submitted_at?: string | null;
  };
  observations: Array<{
    check_code: string | null;
    result: string;
    notes: string | null;
  }>;
  readings: Array<{
    field_name: string;
    group_key: string | null;
    value_numeric: number | null;
    value_text: string | null;
  }>;
  assets: Array<{
    asset_type: string;
    identifier: string | null;
    model: string | null;
    serial_number: string | null;
  }>;
  /** Injected for tests so stale-copy detection is deterministic. */
  now?: Date;
}

/**
 * Structural mirror of InspectionFormSchema from lib/db/types.ts.
 * Re-declared locally so the validation module has no DB import.
 */
export interface InspectionFormSchemaLike {
  form_id: string;
  form_name: string;
  fields: InspectionFormFieldLike[];
}

export interface InspectionFormFieldLike {
  name: string;
  label: string;
  data_type:
    | "text"
    | "long_text"
    | "date"
    | "number"
    | "boolean"
    | "triplet"
    | "enum"
    | "signature"
    | "photo";
  category: "header" | "asset" | "observation" | "reading" | "checkbox" | "signature";
  required: boolean;
  group: string | null;
  asset_role: string | null;
  servicetrade_field?: boolean;
}
