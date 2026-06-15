import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { extractAcroFields, checkPdfCompleteness } from "./completeness";
import type { AiProvider } from "./types";

async function pdfWithFields(values: Record<string, string>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  let y = 360;
  for (const [name, value] of Object.entries(values)) {
    const tf = form.createTextField(name);
    tf.setText(value);
    tf.addToPage(page, { x: 20, y, width: 200, height: 18 });
    y -= 24;
  }
  return doc.save();
}

function stubProvider(output: string): AiProvider {
  return {
    name: "mock",
    defaultModel: "stub",
    async generate() {
      return { provider: "mock", model: "stub", output };
    },
  };
}

describe("extractAcroFields", () => {
  it("reads filled and blank text fields by name", async () => {
    const bytes = await pdfWithFields({ "Suction PSI": "55", "Discharge PSI": "" });
    const fields = await extractAcroFields(bytes);
    assert.equal(fields["Suction PSI"], "55");
    assert.equal(fields["Discharge PSI"], "");
  });
});

describe("checkPdfCompleteness", () => {
  it("maps the AI's reported gaps into error-severity issues", async () => {
    const bytes = await pdfWithFields({ "Suction PSI": "55", "Discharge PSI": "" });
    const provider = stubProvider(
      JSON.stringify({
        missing: [{ field: "Discharge Pressure", reason: "blank on report" }],
        satisfied_count: 1,
      }),
    );
    const result = await checkPdfCompleteness(
      {
        pdfBytes: bytes,
        formName: "Monthly Fire Pump Report",
        requiredFields: ["Suction Pressure", "Discharge Pressure"],
      },
      provider,
    );
    assert.equal(result.ok, false);
    assert.equal(result.summary.errors, 1);
    assert.equal(result.summary.required_total, 2);
    assert.equal(result.summary.required_complete, 1);
    const issue = result.issues.find((i) => i.rule === "missing_required");
    assert.ok(issue);
    assert.equal(issue!.severity, "error");
    assert.match(issue!.field_label ?? "", /Discharge Pressure/);
  });

  it("returns ok=true when the AI reports nothing missing", async () => {
    const bytes = await pdfWithFields({ "Suction PSI": "55" });
    const provider = stubProvider(JSON.stringify({ missing: [], satisfied_count: 1 }));
    const result = await checkPdfCompleteness(
      { pdfBytes: bytes, formName: "X", requiredFields: ["Suction Pressure"] },
      provider,
    );
    assert.equal(result.ok, true);
    assert.equal(result.summary.errors, 0);
  });
});
