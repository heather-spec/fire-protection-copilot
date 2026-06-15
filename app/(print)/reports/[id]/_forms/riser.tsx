// Riser Form — form_id: riser_v1
// Single-page form with a per-system table (wet/dry/pre-action/deluge) plus
// water test results plus signature.

import { AssetRow } from "@/components/reports/asset-row";
import { FormHeader } from "@/components/reports/form-header";
import { FormSection } from "@/components/reports/form-section";
import { ObservationRow } from "@/components/reports/observation-row";
import { ReadingGrid } from "@/components/reports/reading-grid";
import { SignatureBlock } from "@/components/reports/signature-block";
import type { Asset } from "@/lib/db/types";

import { findObs, partitionFields, type FormProps } from "./types";

export function RiserForm({
  schema,
  workRecord,
  observations,
  readings,
  assets,
}: FormProps) {
  const { header, signature } = partitionFields(schema);
  const fields = schema.fields ?? [];

  // Group system_row fields per asset. Each row maps to one sprinkler_system asset.
  const systemFields = fields.filter((f) => f.group === "system_row");
  const waterTestFields = fields.filter((f) => f.group === "water_test_row");
  const observationFields = fields.filter(
    (f) => f.category === "observation" && f.group !== "system_row",
  );
  const longTextFields = fields.filter((f) => f.data_type === "long_text");

  const sprinklerSystems: Asset[] = assets.filter(
    (a) => a.asset_type === "sprinkler_system",
  );

  return (
    <article className="space-y-4 text-sm">
      <FormHeader
        title={schema.form_name}
        fields={header}
        workRecord={workRecord}
        rtfFormVersion={schema.rtf_form_version}
        nfpaStandard={schema.nfpa_standard}
      />

      <FormSection title="Systems" number={1}>
        {sprinklerSystems.length === 0 ? (
          <AssetRow fields={systemFields} asset={null} />
        ) : (
          <div className="space-y-2">
            {sprinklerSystems.map((sys, i) => (
              <AssetRow
                key={sys.id}
                fields={systemFields}
                asset={sys}
                layout="inline"
                label={`System ${i + 1}`}
              />
            ))}
          </div>
        )}
      </FormSection>

      {waterTestFields.length > 0 ? (
        <FormSection title="Water test results" number={2}>
          <ReadingGrid fields={waterTestFields} readings={readings} />
        </FormSection>
      ) : null}

      {observationFields.length > 0 ? (
        <FormSection title="Observations" number={3}>
          {observationFields
            .filter((f) => f.data_type === "triplet")
            .map((f) => (
              <ObservationRow
                key={f.name}
                field={f}
                obs={findObs(observations, f.name)}
              />
            ))}
        </FormSection>
      ) : null}

      {longTextFields.map((f) => {
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
