# ServiceTrade Integration Results

**Session date:** 2026-06-11
**Status:** ✅ COMPLETE through upload. All 5 production templates pushed to the
demo account and verified via API. Remaining: UI auto-fill check (needs web login).

## Uploaded attachments (job #43540754, id 2222888809272897, "TACO #33793")

| template | attachment id |
|---|---|
| backflow_v1.pdf | 2600311466963457 |
| annual_inspection_v1.pdf | 2600312071216833 |
| riser_v1.pdf | 2600312127489217 |
| fire_pump_v1.pdf | 2600312159016577 |
| fire_hydrant_v1.pdf | 2600312204542977 |

Post-push verification via `GET /attachment?entityId=2222888809272897&entityType=3`:
exactly 5 attachments on the job, all `purpose="Blank Paperwork"`, no duplicates.

**Idempotency discovery:** an accidental second push of identical files returned
the SAME attachment IDs — ServiceTrade dedupes identical content (checksum-based)
rather than creating duplicates. Re-pushing unchanged templates is safe.

---

## What worked

### PDF generation — all 8 forms, full field fidelity

`npm run pdf:build` produced 8 PDFs in `scripts/pdf-out/`. Programmatic
verification (pdf-lib, comparing every AcroForm field name against
`schema/*.json`):

| form_id | AcroForm fields | missing | extra | `servicetrade_*` | pages |
|---|---|---|---|---|---|
| annual_inspection_v1 | 116 | 0 | 0 | 8 | 4 |
| fire_pump_v1 | 72 | 0 | 0 | 8 | 3 |
| fire_hydrant_v1 | 68 | 0 | 0 | 8 | 3 |
| backflow_v1 | 32 | 0 | 0 | 8 | 2 |
| riser_v1 | 23 | 0 | 0 | 8 | 1 |
| annual_inspection_alt5 | 117 | 0 | 0 | 0 | 3 |
| annual_inspection_legacy | 116 | 0 | 0 | 0 | 4 |
| combined_customer_v1 | 0 (deliverable wrapper) | 0 | 0 | 0 | 1 |

Field-count notes: triplet fields expand to three checkboxes
(`<name>__YES/__NA/__NO` per the renderer); `signature` and `photo` render as
drawn elements, not AcroForm fields. Zero missing/extra everywhere means the
schema → PDF contract holds exactly.

The 8 merge fields present verbatim on every production form:
`servicetrade_location_name`, `servicetrade_location_street`,
`servicetrade_location_city`, `servicetrade_location_phone`,
`servicetrade_location_email`, `servicetrade_job_number`,
`servicetrade_job_dates`, `servicetrade_job_technicians`.

---

## What changed from the scaffold (both TODO guesses were wrong)

### 1. Auth shape

- Scaffold guessed: `POST /oauth/token` or session `POST /auth`.
- **Actual:** `POST /api/oauth2/token`, OAuth2 client credentials,
  form-encoded body. Returns a 24h bearer token + refresh token.
- Credential identity verified via `GET /api/oauth2/userinfo`:
  account **9000 "RTF Fire Protection, LLC DEMO"**, company **4360744**.
  This is a sandbox (partial clone of real RTF data, ~Dec 2021 snapshot) —
  safe for writes, never to be confused with production.

### 2. Upload endpoint

- Scaffold guessed: `POST /api/documenttemplate` (multipart).
- **Actual: there is no document-template endpoint in the API at all**
  (verified against the full OpenAPI spec, 213 paths, saved at
  `~/Desktop/rtf-fire/st_openapi.json`). ServiceTrade's fillable-form
  mechanism is the attachment system:
  - `POST /api/attachment` — the API's only multipart endpoint
  - file field MUST be named `uploadedFile`
  - `purposeId=10` ("Blank Paperwork" — constants table in spec)
  - `entityType=3` (Job) + `entityId=<job id>`
  - ServiceTrade merges job/location/technician data into the PDF's
    `servicetrade_*` AcroForm fields when paperwork is opened/generated
    in the app context.
- Evidence this is the real RTF pattern: the sandbox already contains
  `MPR form.pdf` with `purpose="Blank Paperwork"` on job 23657976.

### 3. Push targeting

- Default push set is now ONLY the 5 production forms
  (`annual_inspection_v1`, `riser_v1`, `fire_pump_v1`, `fire_hydrant_v1`,
  `backflow_v1`) per the handoff's guidance; legacy/alt5/combined are
  excluded unless named explicitly.
- Test target job: **#43540754** (id `2222888809272897`), type=inspection,
  status=new, location "TACO #33793". Set in `.env.local` as
  `SERVICETRADE_TEST_JOB_ID`; overridable with `--job <id>`.
- The script now verifies after upload by listing the job's attachments
  and filtering `purpose === "Blank Paperwork"`.

---

## Templates that failed to upload

None. 5/5 uploaded successfully on the first attempt; no API errors at any
point in the session.

---

## CORRECTION (post-push finding): how pre-fill actually triggers

First UI test showed NO fields populating. Root cause is the trigger flow, not
our PDFs (verified: the known-working MPR blank form in the sandbox uses the
IDENTICAL `servicetrade_*` field names ours do).

Per ServiceTrade's docs ("Creating Technician Reports / Blank Paperwork",
support article 273638, retrieved via archive.org):

1. **Pre-fill happens at GENERATION time only** — via **"Print" on the job
   page (Blank Paperwork option)** on web, or **"Generate Blank Paperwork"**
   in the tablet app. Opening/downloading a job attachment directly serves
   the stored blank file, unfilled. That is what the first test did.
2. **The documented pathway is account-level paperwork RULES**: My Account →
   Blank Paperwork → Add Paperwork Rule (match by customer / job type /
   service line) → upload the PDF to the rule. Matching jobs then offer the
   form in the Print flow, where the merge engine fills it. This admin page
   is UI-only (not in the public API) — consistent with our endpoint survey.
3. Our purpose-10 job attachments may or may not be picked up by the job's
   Print flow; the rule-driven path is the documented one.
4. Other constraints from the docs: no JavaScript in PDFs (stripped at fill
   time), no encryption/password, and custom PDF properties (`repeatAsset`,
   `repeatService`) control per-asset form repetition — relevant later for
   hydrant/backflow multi-asset forms.

**Corrected test procedure:** demo web UI → My Account → Blank Paperwork →
Add Paperwork Rule (job type = Inspection) → upload `backflow_v1.pdf` to the
rule → open job #43540754 → "Print" → Blank Paperwork → check the header
fields. (Also worth trying Print directly first, in case the existing
purpose-10 attachments are picked up.)

## UPDATE 2: layout fix, re-push, and the per-job prefill prototype

1. **Renderer fixed** (`build-pdf-templates.mjs`): label + control now share one
   vertically-centered row (labels no longer float between boxes; triplet rows
   read as proper checklist lines). All 8 PDFs rebuilt; field-name fidelity
   re-verified — zero drift.
2. **Old test attachments deleted** (5 × HTTP 204), fixed versions re-pushed.
   Current attachment IDs on job #43540754: annual_inspection_v1=2600326943323777,
   backflow_v1=2600326985499649, fire_hydrant_v1=2600327013719745,
   fire_pump_v1=2600327046087681, riser_v1=2600327079999105.
3. **NEW: `scripts/prefill-job-paperwork.mjs`** — per-job custom report
   generator. Pulls job + location via API, fills the `servicetrade_*` fields
   with pdf-lib, attaches the pre-filled form to the job
   (`node scripts/prefill-job-paperwork.mjs backflow_v1 <jobId>`). Verified
   end-to-end: attachment id=2600327899321921 round-trips from ServiceTrade
   with all 8 header fields visibly populated on open — no Print/merge flow
   required. This bypasses the rules-page limitation entirely and can fill
   fields ServiceTrade's engine can't (asset data, prior readings, contract
   numbers) once assets are backfilled.

## Remaining steps

1. **UI verification** (needs ServiceTrade web login, which API creds don't
   provide): open demo job #43540754 → Attachments → confirm the 5 blank
   paperwork PDFs are listed → open/generate paperwork → confirm the header
   `servicetrade_*` fields auto-fill from the job's location + technician +
   date. That is the end-to-end success criterion. Screenshot it — it's the
   proposal centerpiece.
2. Note for the future: account-level paperwork-template management
   (Settings → Paperwork Templates in the UI, auto-attach by job type) is
   not exposed in the public API — job-level Blank Paperwork attachment is
   the API-automatable path.

## Useful artifacts

- `~/Desktop/rtf-fire/st_openapi.json` — full OpenAPI spec (213 endpoints)
- `~/Desktop/rtf-fire/servicetrade.env` — working OAuth credentials (chmod 600)
- `~/Desktop/rtf-fire/sample_inspection_report.pdf` — real report downloaded
  via the API (proves the attachment read path end-to-end)
- Entity/purpose constants: Job=3, Location=11, Company=5, Account=13;
  Blank Paperwork=10, Job Paperwork=1, Job Picture=3
