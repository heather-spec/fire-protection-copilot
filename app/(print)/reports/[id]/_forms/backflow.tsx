// Backflow Device Test Report — form_id: backflow_v1
// Single-page form: header → device under test → readings → triplets → result
// → remarks → signature.

import { AssetRow } from "@/components/reports/asset-row";
import { FormHeader } from "@/components/reports/form-header";
import { FormSection } from "@/components/reports/form-section";
import { ObservationRow } from "@/components/reports/observation-row";
import { ReadingGrid } from "@/components/reports/reading-grid";
import { SignatureBlock } from "@/components/reports/signature-block";
import type { Asset } from "@/lib/db/types";

import { findObs, partitionFields, type FormProps } from "./types";

export function BackflowForm({
  schema,
  workRecord,
  observations,
  readings,
  assets,
}: FormProps) {
  const { header, asset, observation, reading, checkbox, signature } =
    partitionFields(schema);

  const device: Asset | undefined =
    assets.find((a) => a.asset_type === "backflow_preventer") ?? assets[0];

  const passed = findObs(observations, "PASSED");
  const failed = findObs(observations, "FAILED");
  const resultText =
    passed?.result?.toLowerCase() === "pass"
      ? "PASSED"
      : failed?.result?.toLowerCase() === "fail"
      ? "FAILED"
      : "—";

  return (
    <article className="space-y-4 text-sm">
      <FormHeader
        title={schema.form_name}
        fields={header}
        workRecord={workRecord}
        rtfFormVersion={schema.rtf_form_version}
        nfpaStandard={schema.nfpa_standard}
      />

      <FormSection title="Device under test">
        <AssetRow fields={asset} asset={device} />
      </FormSection>

      <FormSection title="Test gauge & readings">
        <ReadingGrid fields={reading} readings={readings} />
      </FormSection>

      <FormSection title="Check valves & relief">
        {observation
          .filter((f) => f.data_type === "triplet")
          .map((f) => (
            <ObservationRow key={f.name} field={f} obs={findObs(observations, f.name)} />
          ))}
      </FormSection>

      <FormSection title="Test result">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Result
          </span>
          <span
            className={`rounded px-3 py-1 text-sm font-semibold ${
              resultText === "PASSED"
                ? "bg-emerald-100 text-emerald-800"
                : resultText === "FAILED"
                ? "bg-rose-100 text-rose-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {resultText}
          </span>
          {checkbox.length > 0 ? (
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              {checkbox.length} test-result fields on this form
            </span>
          ) : null}
        </div>
      </FormSection>

      {observation
        .filter((f) => f.data_type === "long_text")
        .map((f) => {
          const obs = findObs(observations, f.name);
          if (!obs?.notes && !obs?.description) return null;
          return (
            <FormSection key={f.name} title={f.label} tone="muted">
              <p className="whitespace-pre-wrap text-xs leading-relaxed">
                {obs.notes ?? obs.description}
              </p>
            </FormSection>
          );
        })}

      <FormSection title="Inspector certification">
        <SignatureBlock fields={signature} workRecord={workRecord} />
      </FormSection>
    </article>
  );
}
