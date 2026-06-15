# Inspection Form Schema — Integration Contract

**Status:** v1, frozen 2026-06-10. All five agents (A through E) build against
this shape. Changes require lead approval.

This is the shared interface between Agent A (schema extraction), Agent B
(data model + template library), Agent C (print templates), Agent D
(completeness checker), and Agent E (Ryder seed).

Source of truth: the real RTF Fire AcroForm PDFs in
`/Users/heathernianouris/Documents/Claude/Projects/rtf-fire/inputs/`.

---

## Hard Rules

1. **Derive required fields ONLY from what's on the forms.** Never invent NFPA
   requirements or codes. If a checklist line on the form has a YES/NO/N/A
   triplet, that's evidence the field exists; only mark `required: true` if the
   form actually requires an answer to be considered "complete" (e.g., header
   identifiers, signatures, readings that appear as empty boxes the inspector
   is expected to fill).
2. **Preserve `servicetrade_*` field names verbatim.** These are the merge
   fields ServiceTrade auto-fills against. Losing the names = ServiceTrade
   auto-fill breaks on any future rebuild. Even if a field is unused in the
   app today, the schema records the name so it round-trips.
3. **`nfpa_reference` is optional and only populated when the form explicitly
   prints a code citation.** Do not infer one. The forms generally do NOT
   print NFPA section numbers per field — most will have `nfpa_reference`
   unset.
4. **No invented options.** Enum `options` come from what's visibly printed
   on the form (e.g., "Wet / Dry / Pre-action / Deluge" on the riser form).
5. **PII out of the schema.** The schema is a structural map. No real customer
   names, addresses, or serial numbers belong in `/schema/*.json`. (Agent E
   handles the real Ryder data in `/scripts/seed-ryder.*`, anonymized.)

---

## Form Identifiers

| `form_id`                   | RTF source PDF                              | Pages | NFPA standard |
|-----------------------------|---------------------------------------------|-------|----------------|
| `annual_inspection_v1`      | `annual inspection report.pdf` (filled)     | 2     | NFPA 25        |
| `annual_inspection_legacy`  | `Inspection Report .pdf` (PowerPoint)       | 2     | NFPA 25        |
| `annual_inspection_alt5`    | `RTF_Inspection_Form_Alt_5.pdf` (rebuilt)   | 2     | NFPA 25        |
| `riser_v1`                  | `riser form.pdf`                            | 1     | NFPA 25        |
| `fire_pump_v1`              | `fire pump.pdf`                             | 1     | NFPA 25        |
| `fire_hydrant_v1`           | `fire hydrant.pdf`                          | 7     | NFPA 25        |
| `backflow_v1`               | `backflow report.pdf`                       | 1     | NFPA 25        |
| `combined_customer_v1`      | `total inspection combined report.pdf`      | 7     | n/a (deliverable) |

`combined_customer_v1` is a **deliverable**, not a fillable form. Its schema
captures the document structure (cover + per-system page ordering), not
input fields.

---

## Top-Level Document Shape

Every form JSON file (`/schema/*.json`) follows this shape:

```jsonc
{
  "$schema": "../_schema_v1.json",         // optional pointer
  "form_id": "backflow_v1",                // matches table above
  "form_name": "Backflow Device Test Report",
  "nfpa_standard": "NFPA 25",              // or "NFPA 72" for alarm
  "rtf_form_version": "7/2020",            // from PDF footer if present
  "page_count": 1,
  "source_pdf": "backflow report.pdf",     // filename relative to rtf-fire/inputs/
  "powerpoint_source": false,              // true if metadata = "Microsoft PowerPoint"

  "fields": [ /* Field[] */ ]
}
```

---

## Field Shape

```jsonc
{
  "name": "Serial No",                     // EXACT AcroForm field name. Required.
  "label": "Serial No.",                   // Visible label printed near the field.
  "data_type": "text",                     // see DATA_TYPES below
  "category": "asset",                     // see CATEGORIES below
  "required": false,                       // ONLY based on form evidence
  "page": 1,                               // 1-indexed page number
  "servicetrade_field": false,             // true ONLY for servicetrade_* fields
  "nfpa_reference": null,                  // null unless printed on form
  "options": null,                         // string[] for enums; null otherwise
  "group": "device_under_test",            // see GROUPS below; null if standalone
  "asset_role": "device",                  // see ASSET_ROLES below; null if not an asset row
  "derived_from": null,                    // string[] if parsed from a composite field
  "notes": ""                              // free text, e.g. "1 of 8 hydrant slots"
}
```

### DATA_TYPES

| `data_type`  | Meaning                                                   |
|--------------|-----------------------------------------------------------|
| `text`       | Short free text                                           |
| `long_text`  | Multi-line free text (General Notes, etc.)                |
| `date`       | Date or month/year                                        |
| `number`     | Numeric reading (PSI, GPM, RPM, count)                    |
| `boolean`    | Single Yes/No (NOT the YES/N/A/NO triplet — see below)    |
| `triplet`    | YES / N/A / NO triplet checkbox group                     |
| `enum`       | Single-select from `options`                              |
| `signature`  | Signature field                                           |
| `photo`      | Photo attachment box                                      |

> **`triplet` is the dominant pattern on RTF forms.** Each checklist line has
> three columns: YES / N/A / NO. We model this as one logical field with three
> sub-fields on the AcroForm side (the agents emit the three real field names
> in `derived_from`).

### CATEGORIES

| `category`     | Meaning                                                              |
|----------------|----------------------------------------------------------------------|
| `header`       | Company/site/job/date/inspector block (most are `servicetrade_*`)    |
| `asset`        | A piece of equipment (pump, valve, hydrant, system, backflow device) |
| `observation`  | A checklist line the inspector answers (the YES/N/A/NO lines)        |
| `reading`      | A numeric measurement (PSI, GPM, RPM, temperature)                   |
| `checkbox`     | Standalone boolean checkbox (e.g., "Are antifreeze systems present?") |
| `signature`    | Signature/date block                                                 |

### GROUPS

`group` strings cluster fields that belong together visually and semantically
on the form, so Agent B can map them to one logical concept (one asset, one
observation row, etc.). Reuse the canonical group keys in this list:

| `group`                  | Meaning                                                      |
|--------------------------|--------------------------------------------------------------|
| `header`                 | Top-of-form ServiceTrade merge block                         |
| `device_under_test`      | Backflow device, fire pump, jockey pump, motor               |
| `control_valve_row`      | One row in the Control Valves table                          |
| `water_test_row`         | One row in the Water Testing Results table                   |
| `system_row`             | One row in the Riser form's per-system table                 |
| `hydrant_slot`           | One numbered hydrant on the Hydrant form                     |
| `flow_test`              | Fire pump or hydrant flow test grid (multi-reading)          |
| `wet_systems`            | Wet system / antifreeze block                                |
| `dry_systems`            | Dry system block                                             |
| `pre_action`             | Pre-action / deluge block                                    |
| `alarms`                 | Alarm test block                                             |
| `sprinklers_piping`      | Sprinklers / piping block                                    |
| `general_notes`          | Section 10 free text                                         |
| `pictures`               | Section 11 photo boxes                                       |
| `signature`              | Signature/date/printed-name block                            |

### ASSET_ROLES

`asset_role` is set only on `category: "asset"` fields. Use these canonical
values so Agent E and Agent B's data model line up with the existing
`rtf_asset_extractor.py` output.

| `asset_role`              | Asset type                                                  |
|---------------------------|-------------------------------------------------------------|
| `main_pump`               | The primary fire pump                                        |
| `jockey_pump`             | The jockey pump (suffix `_2` on RTF fire pump form)         |
| `pump_motor`              | The fire pump motor (suffix `_3` on RTF fire pump form)     |
| `device`                  | Backflow device                                              |
| `hydrant`                 | Numbered hydrant slot                                        |
| `sprinkler_system`        | A row on the riser form (one system)                        |
| `control_valve`           | A control valve in the per-form table                       |

Asset rows are emitted as composite fields whose `derived_from` lists the
underlying AcroForm field names (`MANUFACTURER`, `MODEL or TYPE`, `SERIAL NO`,
etc.).

---

## Index File

`/schema/index.json` is the manifest Agent A also publishes:

```jsonc
{
  "version": "1",
  "generated_at": "2026-06-10",
  "forms": [
    {
      "form_id": "backflow_v1",
      "source_pdf": "backflow report.pdf",
      "page_count": 1,
      "field_count": 53,
      "servicetrade_field_count": 8,
      "json_path": "backflow.json"
    },
    /* one entry per form_id above */
  ]
}
```

---

## Required-Field Logic for Agent D

Agent D (completeness checker) computes "is this work record complete?" using:

1. **`required: true` fields must be non-empty.** Driven by the schema.
2. **For `triplet` fields**, exactly one of {YES, N/A, NO} must be selected on
   each line. If none, the line is incomplete; if multiple, the line is
   inconsistent.
3. **For asset rows**, at least one of `model`, `serial_number`, or `asset_name`
   must be populated (otherwise the row is empty and should not be counted).
4. **For reading rows** (water test, flow test), all readings on a row must be
   present once ANY reading on that row is filled. Half-filled rows are flagged
   ("Mike's missing readings" — the real test case from the discovery day
   notes — fits this rule).
5. **Stale-copy detection**: if `header.date` is older than 90 days at submit
   time, flag as `stale_copy_suspect`. (Not used to block — only to warn.)

---

## Print Template Mapping for Agent C

Agent C reproduces the visual structure of each form as an HTML print
template. The contract for print components:

- One React server component per `form_id` at
  `/app/(print)/reports/[id]/_forms/<form_id>.tsx`.
- Component accepts a `WorkRecord` + per-form observations and reads the
  schema to map values back to printed positions.
- The combined customer report (`combined_customer_v1`) is a wrapper that
  renders multiple per-form components in sequence with consistent page
  numbering and a cover sheet.

---

## Data Model Mapping for Agent B

Each schema field maps to a row in either `assets`, `work_record_observations`,
or a new `work_record_readings` table (see Agent B's migration). The mapping
is by `category`:

| `category`     | Target table / column                                       |
|----------------|-------------------------------------------------------------|
| `header`       | `work_records.metadata.servicetrade.*`                      |
| `asset`        | `assets` row + asset role mapping                           |
| `observation`  | `work_record_observations` row (one per triplet/checkbox)   |
| `reading`      | `work_record_readings` row (new table — Agent B owns)       |
| `checkbox`     | `work_record_observations` row, result = "pass"/"fail"/"na" |
| `signature`    | `work_records.metadata.signatures[]`                        |

Agent B also produces an `inspection_templates` seed with one template per
`form_id`, where each template item references the schema field by `name`.

---

## Owner & Versioning

- This contract is owned by the lead (orchestrator).
- Agents may not introduce new top-level keys without lead approval.
- New asset roles or groups MAY be added with PR notes; the lead reconciles.
- Bump `version` on `index.json` if a non-additive change ships.
