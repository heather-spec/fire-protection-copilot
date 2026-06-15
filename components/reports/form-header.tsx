// Renders the header block for an RTF Fire Protection inspection form.
// The header collects the servicetrade_* merge fields plus the RTF branding bar.
// We don't have the real RTF logo asset in the repo, so we render a text mark.

import type { InspectionFormField, InspectionFormSchema } from "@/lib/db/types";
import type { WorkRecordDetail } from "@/lib/db/queries";
import { formatDate } from "@/lib/utils/format";

interface FormHeaderProps {
  title: string;
  fields: InspectionFormField[];
  workRecord: WorkRecordDetail;
  rtfFormVersion?: string | null;
  nfpaStandard?: string | null;
  schema?: InspectionFormSchema;
}

// Map a header field name to the actual value we have on the work record.
// The schema field names are the verbatim servicetrade_* identifiers from the
// real AcroForms — we shim them onto our existing WorkRecord shape.
function resolveHeaderValue(
  field: InspectionFormField,
  record: WorkRecordDetail,
): string {
  const md = (record.metadata ?? {}) as Record<string, unknown>;
  const stMd = ((md.servicetrade as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >;

  // Prefer values stored in metadata.servicetrade.<field_name>; fall back to
  // the closest first-class column on the record.
  const direct = stMd[field.name];
  if (typeof direct === "string" && direct.length > 0) return direct;

  switch (field.name) {
    case "servicetrade_location_name":
      return record.site?.name ?? record.customer?.name ?? "";
    case "servicetrade_location_street":
      return record.site?.address_line1 ?? "";
    case "servicetrade_location_city": {
      const parts = [record.site?.city, record.site?.state, record.site?.postal_code].filter(
        Boolean,
      );
      return parts.join(", ");
    }
    case "servicetrade_job_number":
      return record.reference_code ?? "";
    case "servicetrade_job_dates":
      return formatDate(record.completed_at ?? record.scheduled_for, "MMM d, yyyy") ?? "";
    case "servicetrade_job_technicians":
      return record.technician?.full_name ?? "";
    default:
      return typeof direct === "string" ? direct : "";
  }
}

export function FormHeader({
  title,
  fields,
  workRecord,
  rtfFormVersion,
  nfpaStandard,
}: FormHeaderProps) {
  return (
    <header className="overflow-hidden rounded-md border border-slate-300 print:break-inside-avoid">
      {/* RTF brand bar: navy w/ diagonal orange accent (text-only fallback) */}
      <div className="relative flex items-center justify-between bg-[#0b1f4d] px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded bg-white/10 px-2 py-1 text-xs font-bold tracking-widest">
            RTF
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">RTF Fire Protection</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">
              Cincinnati, OH
            </div>
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="text-sm font-semibold">{title}</div>
          {nfpaStandard ? (
            <div className="text-[10px] uppercase tracking-wider opacity-80">
              {nfpaStandard}
              {rtfFormVersion ? ` · Rev ${rtfFormVersion}` : ""}
            </div>
          ) : null}
        </div>
        {/* Diagonal accent stripe (decorative) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-32 w-12 -skew-x-12 bg-orange-500/80"
        />
      </div>

      {/* Header field grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 bg-white px-4 py-3 text-xs">
        {fields.map((field) => {
          const value = resolveHeaderValue(field, workRecord);
          return (
            <div key={field.name} className="flex flex-col">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                {field.label}
              </dt>
              <dd className="mt-0.5 min-h-[1.25rem] rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-medium text-slate-900">
                {value || <span className="text-slate-400">—</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </header>
  );
}
