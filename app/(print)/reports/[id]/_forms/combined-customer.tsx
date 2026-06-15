// Combined Customer Report — form_id: combined_customer_v1
// The deliverable Dawn assembles manually today: cover sheet listing the
// customer + site + inspection date range + every system inspected, then one
// per-form component for each per-system schema in sequence with a page break
// between them.

import { AnnualInspectionForm } from "./annual-inspection";
import { AnnualInspectionAlt5Form } from "./annual-inspection-alt5";
import { AnnualInspectionLegacyForm } from "./annual-inspection-legacy";
import { BackflowForm } from "./backflow";
import { FireHydrantForm } from "./fire-hydrant";
import { FirePumpForm } from "./fire-pump";
import { RiserForm } from "./riser";

import type {
  Asset,
  InspectionFormSchema,
  WorkRecordObservation,
  WorkRecordReading,
} from "@/lib/db/types";
import type { WorkRecordDetail } from "@/lib/db/queries";
import { formatDate } from "@/lib/utils/format";

export interface CombinedPerFormData {
  formId: string;
  schema: InspectionFormSchema;
  observations: WorkRecordObservation[];
  readings: WorkRecordReading[];
  assets: Asset[];
}

export interface CombinedProps {
  workRecord: WorkRecordDetail;
  perFormData: CombinedPerFormData[];
}

const FORM_RENDERERS: Record<
  string,
  (
    props: Omit<CombinedPerFormData, "formId"> & { workRecord: WorkRecordDetail },
  ) => JSX.Element
> = {
  annual_inspection_v1: (p) => <AnnualInspectionForm {...p} />,
  annual_inspection_legacy: (p) => <AnnualInspectionLegacyForm {...p} />,
  annual_inspection_alt5: (p) => <AnnualInspectionAlt5Form {...p} />,
  riser_v1: (p) => <RiserForm {...p} />,
  fire_pump_v1: (p) => <FirePumpForm {...p} />,
  fire_hydrant_v1: (p) => <FireHydrantForm {...p} />,
  backflow_v1: (p) => <BackflowForm {...p} />,
};

export function CombinedCustomerReport({ workRecord, perFormData }: CombinedProps) {
  const dateLabel =
    formatDate(workRecord.completed_at ?? workRecord.scheduled_for, "MMMM yyyy") ?? "";

  return (
    <article className="space-y-8 text-sm">
      {/* Cover sheet */}
      <section className="flex min-h-[60vh] flex-col justify-between rounded-md border border-slate-300 bg-white p-8 print:break-after-page">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded bg-[#0b1f4d] px-3 py-2 text-base font-bold tracking-widest text-white">
              RTF
            </div>
            <div>
              <div className="text-lg font-semibold">RTF Fire Protection</div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Cincinnati, OH
              </div>
            </div>
          </div>
          <div className="text-right text-xs uppercase tracking-wider text-slate-500">
            Inspection report
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Customer
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            {workRecord.customer?.name ?? "—"}
          </h1>
          <div className="text-xl text-slate-700">{workRecord.site?.name ?? "—"}</div>
          <div className="text-sm text-slate-600">
            {[
              workRecord.site?.address_line1,
              workRecord.site?.city,
              workRecord.site?.state,
              workRecord.site?.postal_code,
            ]
              .filter(Boolean)
              .join(", ")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Inspection period
            </div>
            <div className="mt-0.5 text-sm font-medium">{dateLabel || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Report number
            </div>
            <div className="mt-0.5 text-sm font-medium">
              {workRecord.reference_code ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Lead technician
            </div>
            <div className="mt-0.5 text-sm font-medium">
              {workRecord.technician?.full_name ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              AHJ
            </div>
            <div className="mt-0.5 text-sm font-medium">{workRecord.site?.ahj ?? "—"}</div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Systems inspected
          </div>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm">
            {perFormData.map((p) => (
              <li key={p.formId}>{p.schema.form_name}</li>
            ))}
          </ol>
        </div>

        <div className="flex items-end justify-between border-t border-slate-200 pt-4 text-[10px] uppercase tracking-wider text-slate-500">
          <span>Generated by Fire Protection Compliance Copilot</span>
          <span>
            {perFormData.length} system{perFormData.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {/* Per-form sections, each on its own page */}
      {perFormData.map((p, idx) => {
        const renderer = FORM_RENDERERS[p.formId];
        return (
          <section
            key={`${p.formId}-${idx}`}
            className="space-y-4 print:break-before-page"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-1 text-[10px] uppercase tracking-wider text-slate-500">
              <span>
                {p.schema.form_name} · {workRecord.customer?.name ?? ""}
              </span>
              <span>
                Page section {idx + 1} of {perFormData.length}
              </span>
            </div>
            {renderer ? (
              renderer({
                schema: p.schema,
                workRecord,
                observations: p.observations,
                readings: p.readings,
                assets: p.assets,
              })
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                No print renderer registered for form_id <code>{p.formId}</code>.
              </div>
            )}
          </section>
        );
      })}
    </article>
  );
}
