// Shared props for every per-form print component. Each component receives the
// schema (so it knows which fields to render in which slot), the work record +
// its observations + readings + assets, and renders the structured page.

import type {
  Asset,
  InspectionFormSchema,
  WorkRecordObservation,
  WorkRecordReading,
} from "@/lib/db/types";
import type { WorkRecordDetail } from "@/lib/db/queries";

export interface FormProps {
  schema: InspectionFormSchema;
  workRecord: WorkRecordDetail;
  observations: WorkRecordObservation[];
  readings: WorkRecordReading[];
  assets: Asset[];
}

// Helper: find one observation row by check_code (== schema field name).
export function findObs(
  observations: WorkRecordObservation[],
  fieldName: string,
): WorkRecordObservation | undefined {
  return observations.find((o) => o.check_code === fieldName);
}

// Helper: split a schema's fields into the standard buckets we render. Caller
// can further narrow by `group` for forms that have multiple sections.
export function partitionFields(schema: InspectionFormSchema) {
  const fields = schema.fields ?? [];
  return {
    header: fields.filter((f) => f.category === "header"),
    asset: fields.filter((f) => f.category === "asset"),
    observation: fields.filter((f) => f.category === "observation"),
    reading: fields.filter((f) => f.category === "reading"),
    checkbox: fields.filter((f) => f.category === "checkbox"),
    signature: fields.filter((f) => f.category === "signature"),
  };
}
