# RTF Discovery — Technical Brief

*State of discovery as of 2026-06-12. For Jon. Every figure was queried from
RTF's live ServiceTrade account (account 9316) via a read-only API client, or
from the demo account (9000) where writes were sanctioned. All live access went
through a GET-only wrapper that logs every request.*

---

## 1. How we accessed it

- **Auth:** OAuth2 client-credentials, `POST /api/oauth2/token`, 24h bearer.
  Two credential sets: live (read-only, account 9316) and demo (read/write,
  account 9000). Account identity confirmed per call via `GET /oauth2/userinfo`.
- **Safety:** all live work routed through `st_live_readonly.py` — a client with
  no method parameter and no write path; only `GET` plus the one auth `POST`.
  Every call appended to `live-request-log.txt`. No writes to live, ever.
- **Coverage:** full account-scale counts, full asset pull, sampled jobs/
  attachments/deficiencies/recurrences, and a 55-PDF archive census across
  2022–2026. Demo account used to test writes (asset creation, attachment upload,
  the merge test).

---

## 2. How RTF completes inspection forms today

The workflow, mechanically:

1. Inspection job is created in ServiceTrade (recurring schedule generates it).
   Each job carries one or more **service requests**, each tagged with a
   `serviceLine` (Sprinkler, Backflow, Fire Alarm, etc.).
2. The tech needs a blank form. ServiceTrade *has* a "Blank Paperwork" system
   (rule-driven fillable PDFs attached by job type / service line), but RTF's
   equipment data is empty, so the forms would come out blank anyway.
3. **So the tech sources the form from last year instead** — pulls the prior
   report PDF from Dropbox, copies it, deletes last year's readings, keeps the
   equipment identity block, fills in current readings, saves back to Dropbox
   for next year.
4. The finished PDF is uploaded to the job as an **attachment with
   `purposeId=1` ("Job Paperwork")**. That's where the inspection data lives —
   a flat PDF, not structured records.

**Key finding (confirms your point):** RTF does not use ServiceTrade's digital
task/checklist form engine at all. Verified account-wide:
`GET /taskinstance?status=completed` → empty; active task lists → empty. Zero
task instances anywhere. Their inspection data model is "PDF stapled to a job."
The parity bar is a PDF attachment workflow, not ServiceTrade's form engine.

Volume: **~790 completed jobs/month**, 33,080 completed jobs all-time.

---

## 3. Why this is broken (technical root causes)

**a. Equipment records are empty.** ServiceTrade's value engine keys off `asset`
records per `location`. Live reality:

| | Count |
|---|---|
| Locations | 5,317 |
| Locations with ≥1 real equipment asset | 906 (**17%**) |
| Real equipment assets total | 2,901 |
| ...of which backflow | 2,098 (**72%**, BSI-portal-forced) |
| Fire pumps (whole company) | 20 |
| Sprinkler systems / hydrants | ≈ 0 |
| Avg populated properties on a real asset | 6.2 |

**b. The forms can't be read or merged.** The 21 inspection forms were authored
in PowerPoint and exported to PDF. AcroForm field detection auto-named the
fields (`Check Box 23`, numeric names). On the worst forms 90%+ of fields are
junk-named (riser form: 249 of 269). Consequences:
- ServiceTrade's merge engine can't populate them (it matches on
  `servicetrade_*` dictionary names, which aren't there except in the header).
- Completed forms aren't machine-readable — the data dies in the PDF.
- Re-exporting from PowerPoint re-randomizes the names, so they can't be
  maintained.

**c. Nothing links jobs/services to assets.** Even where assets exist, the job's
service requests don't reference them. A job page shows `Assets: 0` at a
location that has 24 backflow records one click away. So an inspector opening a
job sees nothing, and deficiencies attach to a placeholder "Building" asset
(100/100 sampled deficiencies linked to placeholders, 0 to real equipment).

**d. No native path to backfill.** ServiceTrade can consume asset records but
ships nothing to create them from historical reports. Smart Scan is
forward-only (nameplate photo on a future visit), Premium-tier, and would take
years across 5,300 locations.

Net: the platform's inspection automation is gated behind asset data that
(1) doesn't exist, (2) can't be created by any ServiceTrade feature, and (3)
wouldn't populate the current forms even if it did.

---

## 4. What we proved (and how)

**The full chain, demonstrated end-to-end in the demo account:**

1. `POST /asset` — created a backflow asset at a demo location with real device
   data (`{type: backflow, locationId, properties: {manufacturer, model, serial,
   size, type, location_in_site}}`). Returned id 2601369174989954.
2. Built a test PDF whose fields use native merge-dictionary names
   (`servicetrade_job_assets-backflow-1-manufacturer`, `-serial`, etc.) plus two
   control header fields known to merge.
3. `POST /api/attachment` (multipart, `uploadedFile`, `purposeId=10`,
   `entityType=3`) onto demo job 2222888809272897.
4. Triggered **Print → Blank Paperwork** in the ServiceTrade UI.
5. Result: **all 8 fields populated** in the merged output — controls *and* all
   six asset fields (Watts / 009 / 109285 / 1 1/2" / RP / Riser Room #400).
   Verified by reading the merged PDF's field values with pdf-lib; appearance
   streams present (renders in any viewer).

**Conclusion:** load asset records + give forms correct field names → ServiceTrade
fills the forms itself, via its standard Print flow, with no external software in
the daily path.

**Archive readability census (n=55, 2022–2026):** 73% of `Job Paperwork` PDFs
retain live AcroForm fields → values readable by name, deterministic extraction,
no OCR. The non-readable 27% cluster on national-chain accounts (scanned /
third-party forms) → AI extraction lane. 2024 and 2026 samples were ~90% readable.

---

## 5. What was built (test tooling)

- `st_live_readonly.py` — GET-only live client with request logging.
- Read-only exploration scripts → `~/Desktop/rtf-fire/live-exploration/`
  (scale counts, full asset pull, job/deficiency/recurrence sampling, census).
- `scripts/build-pdf-templates.mjs` — schema → clean fillable PDF generator
  (8 of 21 forms built, AcroForm names verified to the character).
- `scripts/push-to-servicetrade.mjs` — attachment upload pipeline (reverse-
  engineered; ServiceTrade has no document-template endpoint — "templates" are
  `purposeId=10` attachments).
- `scripts/prefill-job-paperwork.mjs` — per-job prefill; reads job/location via
  API, burns values into page content (works around ServiceTrade's inline
  preview not rendering form-field values).
- `schema/*.json` — frozen form schemas (field names + types).
- `schema/servicetrade_merge_fields.json` — scraped full merge dictionary
  (51 standard + 3,376 asset fields across 248 asset types).

---

## 6. The load path (what implementation does)

1. **Harvest:** walk completed inspection jobs per location, pull `Job Paperwork`
   attachments (`GET /attachment?entityId={jobId}&entityType=3`, download
   `contentUrl`). 100% of inspection jobs carry their report PDF.
2. **Extract:** deterministic field-read for the 73% live-AcroForm lane; AI
   extraction for scans.
3. **Map → import:** map extracted values to asset `properties`, load via
   `POST /asset` (or bulk `POST /import` + CSV). Idempotent (skip on existing).
   Create the job/service → asset links the current data lacks.
4. **Rebuild forms:** regenerate the 21 forms with `servicetrade_*` + asset
   dictionary field names so the merge fires.

**Built-in validation:** 82% of `servicerecurrence` descriptions encode the
device count (`"(18) Backflow Inspection"`). Reconcile extracted count vs.
recurrence count → matches auto-import, mismatches queue for QA. Mismatches are
also a billing signal (RTF bills per device; stale counts = under-billing).

---

## 7. Verified scale (live, 2026-06-12)

| Metric | Value |
|---|---|
| Customers | 2,089 |
| Locations | 5,317 |
| Completed jobs (all-time) | 33,080 |
| Completed jobs / month | ~790 |
| Recurrences | 23,973 (90% yearly) |
| Invoices | 38,711 |
| Deficiencies | 9,985 |
| Multi-discipline job rate | 30% (one job, multiple service lines) |
| Archive PDFs machine-readable | 73% (≈90% recent years) |
| Task instances (form-engine usage) | 0 |

---

## 8. Open gaps (need confirmation, flagged honestly)

- **Daily office-software usage** is inferred from data volume, not observed.
  Confirmed-in-use: job mgmt, invoicing, recurrence scheduling, Parts Manager,
  ComputerEase connector (STAC), Invoice Link Payments. The Dawn interview
  confirms the daily screen reality.
- **AHJ submission choreography:** two form families exist — RTF's own forms and
  AHJ-specific forms (e.g. City of Monroe backflow, not in the 21). Submission
  splits across BSI (national backflow portal), city portals, and ≥1 paper-+-
  mailed-check county, with the office hand-entering each + processing fees. We
  know the pieces, not the full per-jurisdiction flow. Highest-value Dawn topic.
- **Mobile field experience:** native merge proven on the web Print flow; the
  mobile-app equivalent (assets visible on the job + paperwork prefill on the
  tablet) is documented but not yet witnessed. ~15-min phone test closes it.
- **ComputerEase sync visibility:** `externalIds.computerease` is empty on live
  jobs and invoices, so STAC sync status isn't visible via that field — needs a
  different mechanism if surfaced later.
