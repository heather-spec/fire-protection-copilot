// Annual Inspection — form_id: annual_inspection_legacy
// The PowerPoint-sourced legacy variant. Same logical layout as v1; we delegate
// to the shared renderer. If field labels or grouping diverge meaningfully in
// the legacy schema, the schema's own `group` values still drive section
// dispatch in AnnualInspectionForm, so this component stays a thin shim.

import { AnnualInspectionForm } from "./annual-inspection";
import type { FormProps } from "./types";

export function AnnualInspectionLegacyForm(props: FormProps) {
  return <AnnualInspectionForm {...props} />;
}
