// Signature / date / printed name block. The schema marks signature fields with
// `category: "signature"`. We pull the signature text + printed name + cert
// number from `work_record.metadata.signatures[]` keyed by field name, falling
// back to the technician's profile name.

import type { InspectionFormField } from "@/lib/db/types";
import type { WorkRecordDetail } from "@/lib/db/queries";
import { formatDate } from "@/lib/utils/format";

interface SignatureBlockProps {
  fields: InspectionFormField[];
  workRecord: WorkRecordDetail;
}

interface SignatureEntry {
  field_name?: string;
  value?: string;
  printed_name?: string;
  signed_at?: string;
  cert_number?: string;
}

function findSignature(
  workRecord: WorkRecordDetail,
  fieldName: string,
): SignatureEntry | undefined {
  const md = (workRecord.metadata ?? {}) as Record<string, unknown>;
  const arr = md.signatures;
  if (!Array.isArray(arr)) return undefined;
  return (arr as SignatureEntry[]).find((s) => s.field_name === fieldName);
}

export function SignatureBlock({ fields, workRecord }: SignatureBlockProps) {
  if (fields.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => {
        const entry = findSignature(workRecord, field.name);
        const isCertField = field.name.toLowerCase().includes("cert");
        const printedName =
          entry?.printed_name ??
          workRecord.technician?.full_name ??
          (isCertField ? entry?.cert_number : "") ??
          "";
        const signedAt = entry?.signed_at ?? workRecord.completed_at;

        return (
          <div key={field.name} className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {field.label}
            </div>
            {/* Signature line — italic if we have a captured "signature" value */}
            <div className="min-h-[2.5rem] border-b border-slate-700 px-1 pt-3 text-base italic text-slate-900">
              {entry?.value ?? (isCertField ? entry?.cert_number ?? "" : "")}
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-slate-500">
              <span>{printedName || "Printed name"}</span>
              <span>{formatDate(signedAt, "MMM d, yyyy") || "Date"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
