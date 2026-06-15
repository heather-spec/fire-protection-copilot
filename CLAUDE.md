# RTF Fire — Fire Protection Compliance Copilot

Client: RTF Fire (fire-protection contractor, Cincinnati). Mission: load their equipment
data into ServiceTrade from their own historical report PDFs, rebuild their 21 inspection
forms schema-first, then (Phase 2) automate the office pipeline ("the desk").
Full narrative: `docs/RTF-FORMS-DIAGNOSIS-HANDOFF.md` (client-facing) and
`docs/SERVICETRADE-INTEGRATION-RESULTS.md` (technical log).

## Hard rules

- **NEVER write to the live ServiceTrade account.** All live access goes through
  `~/Desktop/rtf-fire/st_live_readonly.py` (GET-only client, logs every call to
  `live-request-log.txt`). Writes/experiments happen in the DEMO account only.
- Demo = account 9000 "RTF Fire Protection, LLC DEMO" (creds: `~/Desktop/rtf-fire/servicetrade.env`).
  Live = account 9316 (creds: `~/Desktop/rtf-fire/servicetrade-live.env`). Verify
  `GET /oauth2/userinfo` account id before any write script runs.
- `/schema/*.json` is frozen source of truth — never edit; see `schema/_contract.md`.
- AcroForm field names are the contract: `servicetrade_*` names verbatim, asset sections
  use native merge-dictionary names (`schema/servicetrade_merge_fields.json`, 3,427 fields).
- Renderer changes: visually verify `annual_inspection_v1` (longest labels) AND
  `fire_hydrant_v1` (most pages) before pushing — short-label forms hide layout bugs.

## ServiceTrade API facts (hard-won)

- OAuth2: `POST /api/oauth2/token` form-encoded client credentials; 24h bearer. Legacy `/oauth/token` doesn't exist.
- List responses: `{data: {totalPages, page, <plural>: []}}`; `limit=1` → totalPages = total count. Plural keys are inconsistently cased (`servicerequests` vs `jobItems`).
- Attachments: `GET/POST /api/attachment` (the API's ONLY multipart endpoint; file field must be `uploadedFile`). entityType: 3=Job, 11=Location, 5=Company, 16=Appointment. purposeId: 1=Job Paperwork, 10=Blank Paperwork. `contentUrl` = unauthenticated S3.
- No `/documenttemplate` endpoint — "templates" = purpose-10 attachments. Identical uploads dedupe by checksum (re-push is idempotent).
- Asset list REQUIRES `locationId` or `createdAfter`. `POST /asset` needs `{type, locationId, properties}`.
- `job.serviceLine` is a TRAP (always "FP"); discipline lives in `servicerequest.serviceLine` (100% populated). Deficiency filter is `reportingJobId`, not `jobId`. Job date filters: `completedOnBegin/End`.
- Merge engine fills fields ONLY via Print → Blank Paperwork (web) or Generate Blank Paperwork (mobile) — viewing an attachment shows the stored blank.
- PDF viewer trap: ServiceTrade's inline preview (and some viewers) don't render form-field values. Filled-but-blank-looking ≠ empty. Verify with pdf-lib field reads, or burn values into page content (see `scripts/prefill-job-paperwork.mjs`).

## Verified live-account facts (June 2026)

- 5,314 locations / 2,087 customers / ~790 completed jobs/month / 23,973 recurrences.
- Asset coverage: 17% of locations, 72% backflow (BSI-forced). Sprinkler ≈ zero.
- 100% of inspection jobs carry report PDFs; 73% are live AcroForms (read values by name — no OCR); scanned residue clusters on national chains.
- 82% of recurrence descriptions encode device counts ("(18) Backflow Inspection") = import checksum + under-billing audit.
- NATIVE MERGE PROVEN: API-created asset → ServiceTrade Print flow filled `servicetrade_job_assets-backflow-1-*` fields (witnessed; merge test attached to demo job 2222888809272897, test asset 2601369174989954).
- Jobs don't link services to assets anywhere (job pages show "Assets: 0" even where location records exist) — import must create the links.

## Commands

- `npm run pdf:build [form_id]` — generate form PDFs from schemas into `scripts/pdf-out/`
- `npm run st:push [form_id]` — upload to demo job as Blank Paperwork (`SERVICETRADE_TEST_JOB_ID` in `.env.local`)
- `node scripts/prefill-job-paperwork.mjs <form_id> <jobId>` — per-job prefilled form, values burned into page content
- Exploration artifacts/datasets: `~/Desktop/rtf-fire/live-exploration/` (census, findings, samples)

## State (end of 2026-06-12)

Done: 8 forms rebuilt + field-verified; 5 pushed to demo; prefill proven round-trip;
live exploration complete; archive census done; native merge test passed.
Next: field-reader extractor (deterministic lane) → Willow Lake (job #46910433, 18 backflows)
+ 312 Elm (fire pump) worked examples → remaining 16 forms → proposal ($55K Foundation,
Phase 2 desk ~$45K). September 2026 = RTF's ServiceTrade renewal (deadline that matters).
Pending: Alyson credential rotation (emailed secret must die); Dawn interview; mobile-app
field verification (assets visible + paperwork prefill on mobile = still unwitnessed).
