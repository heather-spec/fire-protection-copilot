// Annual Inspection Report — form_id: annual_inspection_v1 (production)
// Two-page form, eleven numbered sections covering wet/dry/pre-action systems,
// alarms, sprinklers/piping, control valves, water test, general notes, photos.

import { AssetRow } from "@/components/reports/asset-row";
import { FormHeader } from "@/components/reports/form-header";
import { FormSection } from "@/components/reports/form-section";
import { ObservationRow } from "@/components/reports/observation-row";
import { ReadingGrid } from "@/components/reports/reading-grid";
import { SignatureBlock } from "@/components/reports/signature-block";
import type { InspectionFormField } from "@/lib/db/types";

import { findObs, partitionFields, type FormProps } from "./types";

// Sections 1-11 from the source PDF. We map group keys → printed labels.
// If a section has no fields in the schema we skip it.
const SECTION_ORDER: Array<{ group: string; title: string; number: number }> = [
  { group: "wet_systems", title: "Wet Pipe / Antifreeze Systems", number: 1 },
  { group: "dry_systems", title: "Dry Pipe Systems", number: 2 },
  { group: "pre_action", title: "Pre-Action / Deluge Systems", number: 3 },
  { group: "alarms", title: "Alarm Test", number: 4 },
  { group: "sprinklers_piping", title: "Sprinklers / Piping", number: 5 },
  { group: "control_valve_row", title: "Control Valves", number: 6 },
  { group: "water_test_row", title: "Water Test Results", number: 7 },
  { group: "device_under_test", title: "Equipment Under Test", number: 8 },
  { group: "flow_test", title: "Flow Test", number: 9 },
  { group: "general_notes", title: "General Notes", number: 10 },
  { group: "pictures", title: "Pictures", number: 11 },
];

function renderObservationGroup(
  fields: InspectionFormField[],
  observations: FormProps["observations"],
) {
  if (fields.length === 0) return null;
  return fields.map((f) => (
    <ObservationRow key={f.name} field={f} obs={findObs(observations, f.name)} />
  ));
}

export function AnnualInspectionForm({
  schema,
  workRecord,
  observations,
  readings,
  assets,
}: FormProps) {
  const { header, signature } = partitionFields(schema);
  const fields = schema.fields ?? [];

  return (
    <article className="space-y-4 text-sm">
      <FormHeader
        title={schema.form_name}
        fields={header}
        workRecord={workRecord}
        rtfFormVersion={schema.rtf_form_version}
        nfpaStandard={schema.nfpa_standard}
      />

      {SECTION_ORDER.map((sec) => {
        const groupFields = fields.filter((f) => f.group === sec.group);
        if (groupFields.length === 0) return null;

        const obsFields = groupFields.filter((f) => f.category === "observation");
        const readingFields = groupFields.filter((f) => f.category === "reading");
        const assetFields = groupFields.filter((f) => f.category === "asset");
        const checkboxFields = groupFields.filter((f) => f.category === "checkbox");
        const longTextFields = groupFields.filter((f) => f.data_type === "long_text");
        const photoFields = groupFields.filter((f) => f.data_type === "photo");

        return (
          <FormSection
            key={sec.group}
            title={sec.title}
            number={sec.number}
            tone={sec.group === "general_notes" || sec.group === "pictures" ? "muted" : "default"}
          >
            {/* Asset rows (e.g., control valves table, system rows) */}
            {assetFields.length > 0 ? (
              <div className="mb-2 space-y-2">
                <AssetRow
                  fields={assetFields}
                  asset={assets[0] ?? null}
                  layout={assetFields.length > 4 ? "inline" : "grid"}
                />
              </div>
            ) : null}

            {/* Reading grid (flow test, water test) */}
            {readingFields.length > 0 ? (
              <div className="mb-2">
                <ReadingGrid fields={readingFields} readings={readings} />
              </div>
            ) : null}

            {/* Standalone checkboxes (e.g., "antifreeze present?") */}
            {checkboxFields.length > 0 ? (
              <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                {checkboxFields.map((f) => {
                  const obs = findObs(observations, f.name);
                  const checked = obs?.result?.toLowerCase() === "pass";
                  return (
                    <label key={f.name} className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-slate-500 ${
                          checked ? "bg-slate-900 text-white" : "bg-white"
                        }`}
                      >
                        {checked ? <span className="text-[9px] leading-none">X</span> : null}
                      </span>
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {/* Observation triplets */}
            {renderObservationGroup(obsFields.filter((f) => f.data_type === "triplet"), observations)}

            {/* Long-text observations (general notes) */}
            {longTextFields.map((f) => {
              const obs = findObs(observations, f.name);
              return (
                <div key={f.name} className="mt-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    {f.label}
                  </div>
                  <div className="mt-0.5 min-h-[3rem] whitespace-pre-wrap rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs leading-relaxed">
                    {obs?.notes ?? obs?.description ?? (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Photo placeholders */}
            {photoFields.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photoFields.map((f) => (
                  <div
                    key={f.name}
                    className="flex h-24 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-[10px] uppercase tracking-wide text-emerald-700"
                  >
                    {f.label}
                  </div>
                ))}
              </div>
            ) : null}
          </FormSection>
        );
      })}

      <FormSection title="Inspector certification">
        <SignatureBlock fields={signature} workRecord={workRecord} />
      </FormSection>
    </article>
  );
}
