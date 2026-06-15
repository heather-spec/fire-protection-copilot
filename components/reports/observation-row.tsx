// One observation line with the YES / N/A / NO triplet checkboxes on the right
// and the field label on the left. Pulls the inspector's answer from the
// observation row whose `check_code` matches the schema field name.

import type { InspectionFormField, WorkRecordObservation } from "@/lib/db/types";

interface ObservationRowProps {
  field: InspectionFormField;
  obs?: WorkRecordObservation | null;
  notesInline?: boolean;
}

type TripletValue = "yes" | "na" | "no" | null;

function normalizeResult(result: string | null | undefined): TripletValue {
  if (!result) return null;
  const r = result.toLowerCase().trim();
  if (r === "yes" || r === "pass") return "yes";
  if (r === "no" || r === "fail") return "no";
  if (r === "na" || r === "n/a") return "na";
  return null;
}

function Box({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-slate-500 ${
        filled ? "bg-slate-900 text-white" : "bg-white"
      }`}
    >
      {filled ? <span className="text-[9px] leading-none">X</span> : null}
    </span>
  );
}

export function ObservationRow({ field, obs, notesInline = true }: ObservationRowProps) {
  const choice = normalizeResult(obs?.result);
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 py-1 last:border-b-0">
      <div className="flex-1 leading-tight">
        <div className="text-xs text-slate-900">{field.label}</div>
        {notesInline && obs?.notes ? (
          <div className="mt-0.5 text-[10px] italic text-slate-600">{obs.notes}</div>
        ) : null}
        {field.nfpa_reference ? (
          <div className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400">
            {field.nfpa_reference}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 pt-0.5 text-[10px] uppercase tracking-wide text-slate-600">
        <label className="flex items-center gap-1">
          <Box filled={choice === "yes"} />
          <span>Yes</span>
        </label>
        <label className="flex items-center gap-1">
          <Box filled={choice === "na"} />
          <span>N/A</span>
        </label>
        <label className="flex items-center gap-1">
          <Box filled={choice === "no"} />
          <span>No</span>
        </label>
      </div>
    </div>
  );
}
