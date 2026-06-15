# Forms Integration — RTF Inspection Schema in the App

**Built 2026-06-10 · Source-of-truth schema mined from real RTF Fire AcroForm PDFs.**

This document is the orchestrator's summary of what landed in this phase, how the
pieces fit together, what's wired up, and what's deliberately deferred.

---

## What this phase produced

Real RTF Fire inspection forms (annual, riser, fire pump, fire hydrant, backflow,
plus the manually-combined customer deliverable) are now first-class objects in
the app's bones:

1. **A JSON form-schema library** under `/schema/` describing every form's
   field structure, preserving the `servicetrade_*` AcroForm merge field names
   so a future ServiceTrade integration round-trips cleanly.
2. **A data model** (migration `0005_inspection_templates.sql`) that loads any
   `/schema/*.json` into a `inspection_templates` table and stores per-record
   numeric measurements in a new `work_record_readings` table.
3. **Print/report templates** that render each form against captured data and
   wrap them into a single multi-system customer report (Dawn's manual-combine
   job, done automatically).
4. **A schema-driven completeness checker** + reviewer panel that flags missing
   required fields, half-filled reading rows (the real "Mike's missing
   readings" test case from the discovery day), stale copies, and triplet
   answer inconsistencies — wired into the reviewer console.
5. **A Ryder demo seed** loading an anonymized version of the real Ryder
   Warehouse Hebron job (job number, addresses, serials all sanitized; public
   product data like Wilkins / Peerless / Kennedy kept).

Five parallel agents owned non-overlapping files. The orchestrator (this doc's
author) published the contract, dispatched the team, and resolved naming
mismatches between Agents B and C in the final merge.

---

## Schema (Agents A + lead)

### Contract

`/schema/_contract.md` is the integration contract every downstream component
keys off. It defines the JSON shape of a form (`form_id`, `form_name`,
`nfpa_standard`, `rtf_form_version`, `page_count`, `source_pdf`,
`powerpoint_source`, `fields[]`), the per-field shape (`name`, `label`,
`data_type`, `category`, `required`, `nfpa_reference`, `servicetrade_field`,
`options`, `group`, `asset_role`, `derived_from`), and the rules every agent
follows:

- **Required fields derive ONLY from form evidence.** No invented NFPA
  requirements. This is the same discipline as the app's AI prompt rules.
- **`servicetrade_*` field names are preserved verbatim** so a future
  ServiceTrade rebuild keeps auto-fill working.
- **`nfpa_reference` is null unless the form prints one** — RTF's forms
  generally don't, so most are unset.
- **No PII in the schema.** Real customer data goes into the (sanitized) seed.

### Forms

| `form_id`                  | Source PDF                              | Fields | ST fields | Pages |
|----------------------------|-----------------------------------------|--------|-----------|-------|
| `backflow_v1`              | `backflow report.pdf`                   | 25     | 8         | 1     |
| `annual_inspection_v1`     | `annual inspection report.pdf` (prod)   | 71     | 8         | 2     |
| `annual_inspection_legacy` | `Inspection Report .pdf` (PowerPoint)   | 71     | 0         | 2     |
| `annual_inspection_alt5`   | `RTF_Inspection_Form_Alt_5.pdf` (rebuilt) | 70   | 0         | 2     |
| `riser_v1`                 | `riser form.pdf`                        | 23     | 8         | 1     |
| `fire_pump_v1`             | `fire pump.pdf`                         | 62     | 8         | 1     |
| `fire_hydrant_v1`          | `fire hydrant.pdf`                      | 68     | 8         | 7     |
| `combined_customer_v1`     | `total inspection combined report.pdf`  | 0 (uses `sections[]`) | 0 | 7 |

`/schema/index.json` is the machine-readable manifest.

### Key modeling decisions

- **YES / N/A / NO checklist lines** model as one `data_type: "triplet"`
  field — not three booleans. `options: ["yes", "na", "no"]` everywhere.
- **The riser form's 15 system rows** model as composite asset rows
  (`asset_role: "sprinkler_system"`) whose `derived_from` lists the
  underlying AcroForm field names per the extractor's offset logic
  (`SYS NORow1` plus base offsets 0, 10, 20, ..., 130).
- **The hydrant form's 12 slots** model as one composite field each with
  `derived_from: ["01"]`, `["11"]`, ..., `["111"]` — the composite-parsing
  note explains the `Make, Model, Year\nLocation` split.
- **Fire pump's three sub-assets** (main pump / jockey pump / motor) model
  with distinct `asset_role` values (`main_pump`, `jockey_pump`, `pump_motor`)
  and explicit `derived_from` mapping to the `MANUFACTURER` / `MANUFACTURER_2`
  / `MANUFACTURER_3` suffix convention used by the existing
  `rtf_asset_extractor.py`.

---

## Data model (Agent B)

### Migration `0005_inspection_templates.sql`

Adds:

- **`inspection_templates`** — one row per `form_id`. `schema_json jsonb` holds
  the full `/schema/<file>.json` blob so downstream consumers don't re-read
  disk at request time. Global reference data: any authenticated user can
  read; writes happen via service role through `lib/db/template-loader.ts`.
- **`work_record_readings`** — numeric measurements (PSI, GPM, RPM, °F)
  separate from observations. Columns: `field_name`, `group_key`,
  `value_numeric`, `value_text`, `unit`, `taken_at`. Org-scoped + RLS via the
  existing `is_org_member` helper.
- **`work_records.template_form_id`** column — links a record to the template
  whose `schema_json` drives form rendering, validation, and printing. Nullable
  so pre-migration records still work.

### Loader & queries

- `lib/db/template-loader.ts` — `loadTemplatesFromSchemaDir()` reads every
  `/schema/*.json` (skipping `_*` and `index.json`) and upserts on `form_id`.
- `lib/db/queries.ts` exports `listInspectionTemplates`, `getInspectionTemplate`,
  and `listReadingsForRecord`. The orchestrator added three name-bridging
  adapters (`getInspectionTemplateForRecord`, `listWorkRecordReadings`,
  `listAssetsForWorkRecord`) so the print page reads cleanly.
- `lib/db/types.ts` exports `InspectionTemplate`, `InspectionFormSchema`,
  `InspectionFormField`, `WorkRecordReading`. The Database type registers the
  two new tables; `WorkRecord` gained `template_form_id`.

---

## Print templates (Agent C)

### Shared primitives in `components/reports/`

- `form-header.tsx` — RTF-branded header bar (navy + diagonal orange accent
  matching the source PDFs) that reads `servicetrade_*` merge fields out of
  `workRecord.metadata.servicetrade.*` with a fallback to the first-class
  WorkRecord columns.
- `form-section.tsx` — Numbered section wrapper for the eleven numbered
  sections on the annual form.
- `observation-row.tsx` — YES / N/A / NO triplet row with one filled box per
  answered observation.
- `asset-row.tsx` — Asset row with grid and inline layouts (inline used for
  the hydrant slots and control-valve table rows).
- `reading-grid.tsx` — Single- and multi-row reading tables (flow tests, water
  tests). Multi-row mode resolves readings by a composite `field_name` like
  `churn.psi`, `rated_flow.gpm`, `overload.rpm`.
- `signature-block.tsx` — Signature / printed name / date / cert number block,
  reading from `workRecord.metadata.signatures[]`.

### Per-form components in `app/(print)/reports/[id]/_forms/`

One component per `form_id` — `annual-inspection.tsx`, `annual-inspection-legacy.tsx`, `annual-inspection-alt5.tsx`, `riser.tsx`, `fire-pump.tsx`, `fire-hydrant.tsx`, `backflow.tsx`. `combined-customer.tsx` is the wrapper that builds the cover sheet + multi-form sequence with `print:break-before-page` separators — replacing Dawn's manual combine step.

### Dispatcher

`app/(print)/reports/[id]/page.tsx`:

1. Looks up `template = await getInspectionTemplateForRecord(record)`
2. If a template exists AND `FORM_COMPONENTS[template.form_id]` has a
   matching renderer, dispatches to it with `(schema, workRecord,
   observations, readings, assets)`.
3. Otherwise falls back to the generic layout — keeps existing records
   working with no `template_form_id` set.

---

## Completeness checker (Agent D)

### What it checks

Per the contract, against any schema:

1. `required: true` fields must be non-empty (severity: error).
2. For `triplet` fields, exactly one of `yes / na / no` must be selected.
   None = `triplet_unanswered`; multiple = `triplet_multiple`.
3. Asset rows with no `model` / `serial_number` / `identifier` are flagged
   `asset_empty` and don't count toward `required_complete`.
4. **Reading partial rule** (the Mike case): if any reading in a `group_key`
   is filled, all readings in that group must be filled. Otherwise emit one
   `reading_partial` per missing field.
5. Stale copy: if header date > 90 days old → `stale_copy_suspect` warning.

### API

```ts
checkCompleteness({
  schema: InspectionFormSchema,
  workRecord, observations, readings, assets,
  now?: Date,                        // injected for tests
}) → CompletenessResult
```

### Reviewer integration

`components/reviewer/completeness-panel.tsx` is dropped into
`app/(app)/work-records/[id]/page.tsx` between the AI draft card and the
workflow card. Shows error/warning counts, per-group expandable issue list,
and a "Ready to approve" badge when `ok && warnings === 0`.

### Tests (`npm test`)

7 cases in `lib/validation/checker.test.ts`, all passing:

1. ✓ Happy path — backflow schema + complete record → ok=true, 0 errors
2. ✓ Missing required header (no `servicetrade_location_name`)
3. ✓ Triplet unanswered
4. ✓ Triplet multiple (conflicting yes + no)
5. ✓ **The Mike case** — partial flow_test row, 2 missing → 2 `reading_partial` errors
6. ✓ Empty asset row → warning, not counted toward required_complete
7. ✓ Stale copy — 100-day-old date → `stale_copy_suspect` warning

Run with `node --test --import tsx lib/validation/checker.test.ts` or just
`npm test`.

---

## Seed (Agent E)

`scripts/_ryder_fixtures.json` is the anonymized Ryder job:

- 1 customer ("Sample Distribution Center (anon)")
- 1 site (1000 Sample Logistics Ln, Hebron, KY 41048)
- 27 assets — main pump (Peerless 8x6 HSC), jockey pump (Grundfos CR-10),
  motor (Baldor M4400T), Wilkins 350A RPZ backflow, 8 Kennedy K81-D hydrants,
  15 Viking sprinkler systems
- 6 work records — one per form_id (annual, riser, fire pump, hydrant,
  backflow) plus one **deliberately incomplete fire-pump test** that
  reproduces the Mike case (partial flow-test row)

All serials are `DEMO-####` and the inspector is "Demo Inspector". Manufacturer
+ model values (publicly available product data) are kept verbatim.

### Scripts

```
npm run templates:load    # populates inspection_templates from /schema/*.json
npm run seed:ryder        # loads the anonymized Ryder job into the demo org
```

Order matters: load templates first, then the seed (which references
`template_form_id`).

---

## How to demo this

After running the SQL migration and the two npm scripts:

1. Open `/work-records` → pick the seeded Ryder backflow record.
2. The reviewer console shows the **Completeness panel** — for the backflow
   record it says "Ready to approve". For the Mike incomplete fire-pump test
   it shows 2 errors (missing peak GPM and RPM).
3. Open `/reports/<id>` → the page renders the schema-driven backflow form
   instead of the generic layout, with all fields, triplets, and signature
   block in their visual positions.
4. The `combined_customer_v1` wrapper isn't yet wired to a single route
   (intentional — it needs a multi-record selection UI). The component is
   ready; that's a small follow-up.

---

## What's deliberately deferred

- **ServiceTrade integration of any kind.** Out of scope. The `servicetrade_*`
  field names are preserved in the schema so a future connector lands cleanly,
  but no API client, no auth, no bulk-import flow shipped here.
- **System-of-record decision.** This phase does not move RTF (or any other
  customer) off ServiceTrade. The app's own work_records + readings tables are
  the source of truth for what gets captured *in this app*, but no migration
  from or sync to ServiceTrade is implied.
- **Form-input UX for technicians.** Print templates render captured data;
  there's no in-app data-entry form yet. Techs would still capture via the
  existing work-record observation editor — the print template is the output
  surface only.
- **`combined_customer_v1` route.** The wrapper component is built but no
  page renders it yet. Needs a multi-record picker.
- **Hardening the asset extractor in JS.** The Python extractor at
  `rtf-fire/code/rtf_asset_extractor.py` is the canonical source. Agent E's
  seed loads pre-extracted data; bringing the JS port into the app is a
  follow-up.

---

## Verification

```
npm run typecheck   # ✓ zero errors
npm run build       # ✓ 27 routes, clean
npm test            # ✓ 7/7 tests pass, including the Mike case
```

---

## File map

```
schema/
├── _contract.md                       # the integration contract (lead-owned)
├── backflow.json                      # worked example (lead-owned)
├── annual_inspection_v1.json          # Agent A
├── annual_inspection_legacy.json      # Agent A
├── annual_inspection_alt5.json        # Agent A
├── riser_v1.json                      # Agent A
├── fire_pump_v1.json                  # Agent A
├── fire_hydrant_v1.json               # Agent A
├── combined_customer_v1.json          # Agent A (uses `sections[]`)
└── index.json                         # Agent A manifest

supabase/
├── migrations/0005_inspection_templates.sql      # Agent B
└── seed/0004_seed_inspection_templates.sql       # Agent B (stub — real loader is node)

lib/
├── db/
│   ├── types.ts                       # Agent B added InspectionTemplate, InspectionFormSchema, WorkRecordReading
│   ├── queries.ts                     # Agent B + orchestrator name-bridging adapters
│   └── template-loader.ts             # Agent B
└── validation/
    ├── checker.ts                     # Agent D — schema-driven completeness
    ├── rules.ts                       # Agent D — per-rule implementations
    ├── types.ts                       # Agent D — local types
    └── checker.test.ts                # Agent D — 7 tests, all pass

components/
├── reports/                           # Agent C — shared print primitives
│   ├── form-header.tsx
│   ├── form-section.tsx
│   ├── observation-row.tsx
│   ├── asset-row.tsx
│   ├── reading-grid.tsx
│   └── signature-block.tsx
└── reviewer/
    └── completeness-panel.tsx         # Agent D

app/(print)/reports/[id]/
├── page.tsx                           # Agent C dispatcher
└── _forms/                            # Agent C — one component per form_id
    ├── types.ts
    ├── annual-inspection.tsx
    ├── annual-inspection-legacy.tsx
    ├── annual-inspection-alt5.tsx
    ├── riser.tsx
    ├── fire-pump.tsx
    ├── fire-hydrant.tsx
    ├── backflow.tsx
    └── combined-customer.tsx

scripts/
├── load-inspection-templates.mjs      # Agent E — populates inspection_templates
├── seed-ryder.mjs                     # Agent E — loads anonymized Ryder data
└── _ryder_fixtures.json               # Agent E — anonymized fixtures (no PII)

docs/
└── FORMS-INTEGRATION.md               # this file (lead)
```
