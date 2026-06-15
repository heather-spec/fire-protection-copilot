// Fire Pump Test Report — form_id: fire_pump_v1
// Single-page form: main pump + jockey pump + motor assets, flow test grid
// (churn / 100% / 150%), triplet observations, signature.

import { AssetRow } from "@/components/reports/asset-row";
import { FormHeader } from "@/components/reports/form-header";
import { FormSection } from "@/components/reports/form-section";
import { ObservationRow } from "@/components/reports/observation-row";
import { ReadingGrid } from "@/components/reports/reading-grid";
import { SignatureBlock } from "@/components/reports/signature-block";

import { findObs, partitionFields, type FormProps } from "./types";

const FLOW_TEST_ROWS = [
  { key: "churn", label: "Churn (0%)" },
  { key: "rated", label: "100% rated" },
  { key: "overload", label: "150% overload" },
];

export function FirePumpForm({
  schema,
  workRecord,
  observations,
  readings,
  assets,
}: FormProps) {
  const { header, signature } = partitionFields(schema);
  const fields = schema.fields ?? [];

  const mainPumpFields = fields.filter((f) => f.asset_role === "main_pump");
  const jockeyPumpFields = fields.filter((f) => f.asset_role === "jockey_pump");
  const motorFields = fields.filter((f) => f.asset_role === "pump_motor");
  const flowTestFields = fields.filter(
    (f) => f.group === "flow_test" && f.category === "reading",
  );
  const otherReadings = fields.filter(
    (f) => f.category === "reading" && f.group !== "flow_test",
  );
  const triplets = fields.filter(
    (f) => f.category === "observation" && f.data_type === "triplet",
  );
  const longTextFields = fields.filter((f) => f.data_type === "long_text");

  // Pick asset rows by type. There may be only one fire_pump record per work
  // record at MVP; the metadata.role distinguishes main vs jockey if needed.
  const fireMain =
    assets.find((a) => a.asset_type === "fire_pump" && a.metadata?.role !== "jockey") ??
    assets.find((a) => a.asset_type === "fire_pump") ??
    null;
  const jockey =
    assets.find((a) => a.asset_type === "fire_pump" && a.metadata?.role === "jockey") ??
    null;

  return (
    <article className="space-y-4 text-sm">
      <FormHeader
        title={schema.form_name}
        fields={header}
        workRecord={workRecord}
        rtfFormVersion={schema.rtf_form_version}
        nfpaStandard={schema.nfpa_standard}
      />

      <FormSection title="Equipment" number={1}>
        <div className="space-y-3">
          {mainPumpFields.length > 0 ? (
            <AssetRow fields={mainPumpFields} asset={fireMain} label="Main fire pump" />
          ) : null}
          {jockeyPumpFields.length > 0 ? (
            <AssetRow fields={jockeyPumpFields} asset={jockey} label="Jockey pump" />
          ) : null}
          {motorFields.length > 0 ? (
            <AssetRow fields={motorFields} asset={fireMain} label="Pump motor" />
          ) : null}
        </div>
      </FormSection>

      {flowTestFields.length > 0 ? (
        <FormSection title="Flow test" number={2}>
          <ReadingGrid
            fields={flowTestFields}
            readings={readings}
            rows={FLOW_TEST_ROWS}
          />
        </FormSection>
      ) : null}

      {otherReadings.length > 0 ? (
        <FormSection title="Other readings" number={3}>
          <ReadingGrid fields={otherReadings} readings={readings} />
        </FormSection>
      ) : null}

      {triplets.length > 0 ? (
        <FormSection title="Inspection checklist" number={4}>
          {triplets.map((f) => (
            <ObservationRow key={f.name} field={f} obs={findObs(observations, f.name)} />
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
