// Annual Inspection — form_id: annual_inspection_alt5
// RTF's rebuilt Alt-5 template. Same eleven-section logical structure as v1;
// the schema's `group` keys handle any field-level differences. Thin shim for
// dispatcher routing.

import { AnnualInspectionForm } from "./annual-inspection";
import type { FormProps } from "./types";

export function AnnualInspectionAlt5Form(props: FormProps) {
  return <AnnualInspectionForm {...props} />;
}
