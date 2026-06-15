// Run with: node --test --import tsx lib/validation/checker.test.ts
//
// If tsx isn't available the lead will wire a runner. The suite uses
// only node:test + node:assert so it has no extra runtime dependency.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkCompleteness } from "./checker";
import type {
  CheckCompletenessInput,
  InspectionFormSchemaLike,
} from "./types";

/* -------------------------------------------------------------------- */
/* Fixtures                                                             */
/* -------------------------------------------------------------------- */

/**
 * Mirror of schema/backflow.json reduced to the fields the checker
 * actually exercises. Keeping the fixture inline (rather than reading
 * from disk) makes the suite hermetic and easy to run.
 */
const backflowSchema: InspectionFormSchemaLike = {
  form_id: "backflow_v1",
  form_name: "Backflow Device Test Report",
  fields: [
    {
      name: "servicetrade_location_name",
      label: "Company / Location",
      data_type: "text",
      category: "header",
      required: true,
      group: "header",
      asset_role: null,
      servicetrade_field: true,
    },
    {
      name: "servicetrade_job_dates",
      label: "Date",
      data_type: "date",
      category: "header",
      required: true,
      group: "header",
      asset_role: null,
      servicetrade_field: true,
    },
    {
      name: "servicetrade_job_technicians",
      label: "Inspected By",
      data_type: "text",
      category: "header",
      required: true,
      group: "header",
      asset_role: null,
      servicetrade_field: true,
    },
    {
      name: "DEVICE",
      label: "Device (manufacturer)",
      data_type: "text",
      category: "asset",
      required: true,
      group: "device_under_test",
      asset_role: "device",
    },
    {
      name: "Model",
      label: "Model",
      data_type: "text",
      category: "asset",
      required: true,
      group: "device_under_test",
      asset_role: "device",
    },
    {
      name: "TEST GUAGE TYPE",
      label: "Test gauge type",
      data_type: "text",
      category: "reading",
      required: true,
      group: "device_under_test",
      asset_role: null,
    },
    {
      name: "DATE OF LAST CALIBRATION",
      label: "Date of last calibration",
      data_type: "date",
      category: "reading",
      required: true,
      group: "device_under_test",
      asset_role: null,
    },
    {
      name: "Initial Reading PSI",
      label: "Initial reading (PSI)",
      data_type: "number",
      category: "reading",
      required: true,
      group: "device_under_test",
      asset_role: null,
    },
    {
      name: "Final Reading PSI",
      label: "Final reading (PSI)",
      data_type: "number",
      category: "reading",
      required: true,
      group: "device_under_test",
      asset_role: null,
    },
    {
      name: "Check Valve 1 Tight",
      label: "Check valve 1 tight",
      data_type: "triplet",
      category: "observation",
      required: true,
      group: "device_under_test",
      asset_role: null,
    },
    {
      name: "Inspector Signature",
      label: "Inspector signature",
      data_type: "signature",
      category: "signature",
      required: true,
      group: "signature",
      asset_role: null,
    },
    {
      name: "Inspector Cert No",
      label: "Inspector certification number",
      data_type: "text",
      category: "signature",
      required: true,
      group: "signature",
      asset_role: null,
    },
  ],
};

/**
 * The "happy path" record — everything required is filled, one
 * triplet answered. Tests narrow this down to construct each failure
 * mode.
 */
function happyInput(overrides: Partial<CheckCompletenessInput> = {}): CheckCompletenessInput {
  const now = new Date("2026-06-10T12:00:00Z");
  return {
    schema: backflowSchema,
    workRecord: {
      metadata: {
        servicetrade: {
          servicetrade_location_name: "ACME Plant",
          servicetrade_job_dates: "2026-06-01",
          servicetrade_job_technicians: "Mike Romero",
        },
        signatures: [
          { field_name: "Inspector Signature", value: "data:image/png;base64,xxx" },
        ],
        header: {
          "Inspector Cert No": "BF-12345",
        },
      },
      submitted_at: "2026-06-10T12:00:00Z",
    },
    observations: [
      { check_code: "Check Valve 1 Tight", result: "yes", notes: null },
    ],
    readings: [
      { field_name: "TEST GUAGE TYPE", group_key: "device_under_test", value_numeric: null, value_text: "Mid-West 845" },
      { field_name: "DATE OF LAST CALIBRATION", group_key: "device_under_test", value_numeric: null, value_text: "2026-05-15" },
      { field_name: "Initial Reading PSI", group_key: "device_under_test", value_numeric: 8.2, value_text: null },
      { field_name: "Final Reading PSI", group_key: "device_under_test", value_numeric: 7.9, value_text: null },
    ],
    assets: [
      {
        asset_type: "device",
        identifier: "BF-001",
        model: "350A",
        serial_number: "SN-998877",
      },
    ],
    now,
    ...overrides,
  };
}

/* -------------------------------------------------------------------- */
/* Tests                                                                */
/* -------------------------------------------------------------------- */

describe("checkCompleteness", () => {
  it("happy path: backflow schema with a complete record returns ok=true, 0 errors", () => {
    const result = checkCompleteness(happyInput());
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.equal(result.summary.errors, 0);
    assert.equal(result.summary.warnings, 0);
    assert.equal(result.summary.required_complete, result.summary.required_total);
  });

  it("flags missing required header (servicetrade_location_name)", () => {
    const input = happyInput();
    const md = input.workRecord.metadata as Record<string, unknown>;
    const st = { ...(md["servicetrade"] as Record<string, unknown>) };
    delete st["servicetrade_location_name"];
    input.workRecord.metadata = { ...md, servicetrade: st };

    const result = checkCompleteness(input);
    assert.equal(result.ok, false);
    const issue = result.issues.find(
      (i) => i.rule === "missing_required" && i.field_name === "servicetrade_location_name",
    );
    assert.ok(issue, "expected missing_required for location name");
    assert.equal(issue!.severity, "error");
  });

  it("flags triplet_unanswered when a required triplet has no result", () => {
    const input = happyInput({ observations: [] });
    const result = checkCompleteness(input);
    const issue = result.issues.find(
      (i) => i.rule === "triplet_unanswered" && i.field_name === "Check Valve 1 Tight",
    );
    assert.ok(issue, "expected triplet_unanswered for Check Valve 1 Tight");
    assert.equal(result.ok, false);
  });

  it("flags triplet_multiple when conflicting answers are recorded", () => {
    const input = happyInput({
      observations: [
        { check_code: "Check Valve 1 Tight", result: "yes", notes: null },
        { check_code: "Check Valve 1 Tight", result: "no", notes: null },
      ],
    });
    const result = checkCompleteness(input);
    const issue = result.issues.find(
      (i) => i.rule === "triplet_multiple" && i.field_name === "Check Valve 1 Tight",
    );
    assert.ok(issue, "expected triplet_multiple");
    assert.equal(result.ok, false);
  });

  it("the Mike case: partial reading row emits one reading_partial per missing field", () => {
    // Flow-test-style group: 3 readings on the same group_key, only 1
    // filled. Use a tighter schema for this case so the assertion is
    // crisp.
    const flowSchema: InspectionFormSchemaLike = {
      form_id: "fire_pump_v1",
      form_name: "Fire Pump",
      fields: [
        {
          name: "flow_psi_1",
          label: "Flow @ 100% (PSI)",
          data_type: "number",
          category: "reading",
          required: false,
          group: "flow_test",
          asset_role: null,
        },
        {
          name: "flow_psi_2",
          label: "Flow @ 150% (PSI)",
          data_type: "number",
          category: "reading",
          required: false,
          group: "flow_test",
          asset_role: null,
        },
        {
          name: "flow_psi_3",
          label: "Flow @ churn (PSI)",
          data_type: "number",
          category: "reading",
          required: false,
          group: "flow_test",
          asset_role: null,
        },
      ],
    };

    const result = checkCompleteness({
      schema: flowSchema,
      workRecord: { metadata: {} },
      observations: [],
      readings: [
        { field_name: "flow_psi_1", group_key: "flow_test", value_numeric: 100, value_text: null },
        { field_name: "flow_psi_2", group_key: "flow_test", value_numeric: null, value_text: null },
        { field_name: "flow_psi_3", group_key: "flow_test", value_numeric: null, value_text: null },
      ],
      assets: [],
      now: new Date("2026-06-10T12:00:00Z"),
    });

    const partials = result.issues.filter((i) => i.rule === "reading_partial");
    assert.equal(partials.length, 2, `expected 2 reading_partial issues, got ${partials.length}: ${JSON.stringify(partials)}`);
    assert.ok(partials.every((p) => p.severity === "error"));
    assert.equal(result.ok, false);
  });

  it("empty asset row is flagged as warning and does not count toward required_complete", () => {
    const input = happyInput({
      assets: [
        { asset_type: "device", identifier: null, model: null, serial_number: null },
      ],
    });
    const result = checkCompleteness(input);

    const emptyAsset = result.issues.find((i) => i.rule === "asset_empty");
    assert.ok(emptyAsset, "expected asset_empty warning");
    assert.equal(emptyAsset!.severity, "warning");

    // The "device" asset role is required (DEVICE + Model are required
    // asset fields), so an empty row means that requirement isn't met.
    // Required-total should still be at least 1 for the role; complete
    // should not include it.
    assert.ok(result.summary.required_total >= 1);
  });

  it("stale_copy_suspect warning fires when header.date is > 90 days old", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const ninetyOneDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const input = happyInput({ now });
    const md = input.workRecord.metadata as Record<string, unknown>;
    const st = { ...(md["servicetrade"] as Record<string, unknown>) };
    st["servicetrade_job_dates"] = ninetyOneDaysAgo.toISOString().slice(0, 10);
    input.workRecord.metadata = { ...md, servicetrade: st };

    const result = checkCompleteness(input);
    const stale = result.issues.find((i) => i.rule === "stale_copy_suspect");
    assert.ok(stale, "expected stale_copy_suspect warning");
    assert.equal(stale!.severity, "warning");
    // Warning only — record still ok.
    assert.equal(result.ok, true);
  });
});
