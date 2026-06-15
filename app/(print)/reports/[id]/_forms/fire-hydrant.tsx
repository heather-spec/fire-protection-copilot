// Fire Hydrant Inspection Report — form_id: fire_hydrant_v1
// 7-page form. Each hydrant has its own slot (`group: "hydrant_slot"`) with
// per-hydrant fields (location, manufacturer, model, year, static / residual
// readings, flow). We render one block per hydrant asset, plus a flow test
// table when present.

import { AssetRow } from "@/components/reports/asset-row";
import { FormHeader } from "@/components/reports/form-header";
import { FormSection } from "@/components/reports/form-section";
import { ObservationRow } from "@/components/reports/observation-row";
import { ReadingGrid } from "@/components/reports/reading-grid";
import { SignatureBlock } from "@/components/reports/signature-block";
import type { Asset, InspectionFormField } from "@/lib/db/types";

import { findObs, partitionFields, type FormProps } from "./types";

function fieldsForSlot(
  slotFields: InspectionFormField[],
  category: InspectionFormField["category"],
): InspectionFormField[] {
  return slotFields.filter((f) => f.category === category);
}

export function FireHydrantForm({
  schema,
  workRecord,
  observations,
  readings,
  assets,
}: FormProps) {
  const { header, signature } = partitionFields(schema);
  const fields = schema.fields ?? [];

  const hydrantSlotFields = fields.filter((f) => f.group === "hydrant_slot");
  const flowTestFields = fields.filter(
    (f) => f.group === "flow_test" && f.category === "reading",
  );
  const longTextFields = fields.filter((f) => f.data_type === "long_text");

  const hydrants: Asset[] = assets.filter((a) => a.asset_type === "hydrant");

  // Per-hydrant slot count from the schema (used when we don't yet have an
  // asset row for every slot).
  const slotsToRender = Math.max(hydrants.length, 1);

  return (
    <article className="space-y-4 text-sm">
      <FormHeader
        title={schema.form_name}
        fields={header}
        workRecord={workRecord}
        rtfFormVersion={schema.rtf_form_version}
        nfpaStandard={schema.nfpa_standard}
      />

      {Array.from({ length: slotsToRender }).map((_, idx) => {
        const hydrant = hydrants[idx] ?? null;
        const assetFields = fieldsForSlot(hydrantSlotFields, "asset");
        const readingFields = fieldsForSlot(hydrantSlotFields, "reading");
        const obsFields = fieldsForSlot(hydrantSlotFields, "observation");

        return (
          <FormSection
            key={hydrant?.id ?? `slot-${idx}`}
            title={`Hydrant ${idx + 1}${hydrant?.identifier ? ` · ${hydrant.identifier}` : ""}`}
            number={idx + 1}
          >
            {assetFields.length > 0 ? (
              <AssetRow fields={assetFields} asset={hydrant} layout="grid" />
            ) : null}
            {readingFields.length > 0 ? (
              <div className="mt-2">
                <ReadingGrid fields={readingFields} readings={readings} />
              </div>
            ) : null}
            {obsFields
              .filter((f) => f.data_type === "triplet")
              .map((f) => (
                <ObservationRow
                  key={`${f.name}-${idx}`}
                  field={f}
                  obs={findObs(observations, f.name)}
                />
              ))}
          </FormSection>
        );
      })}

      {flowTestFields.length > 0 ? (
        <FormSection title="Flow test results">
          <ReadingGrid fields={flowTestFields} readings={readings} />
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
