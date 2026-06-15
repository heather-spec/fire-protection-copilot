# ServiceTrade Demo Account Handoff

**For:** the second Claude session working with mounted access to this repo.
**Mission:** generate clean fillable PDFs from our schema, push them as templates
into the ServiceTrade demo account, verify the `servicetrade_*` auto-fill works
end-to-end.

---

## Context (read this first)

This repo is the Fire Protection Compliance Copilot — a Next.js + Supabase app
built for fire protection contractors. We just finished a phase that mined the
real form schemas out of RTF Fire's AcroForm PDFs and built them into the app.

**Two key facts:**

1. **`/schema/*.json`** holds 8 inspection-form schemas with the EXACT AcroForm
   field names that RTF's existing forms use. Crucially, the `servicetrade_*`
   merge field names are preserved verbatim. ServiceTrade auto-fills against
   those names, so any rebuilt PDF that uses the same names will auto-fill.

2. **RTF's existing forms were built in PowerPoint** and exported to fillable
   PDF. Every edit drifts the field positions and bloats the file. The whole
   point of this work is to **freeze the schema as the source of truth** and
   regenerate PDFs programmatically — no PowerPoint, no drift.

For the full context on what was built in the previous phase, see
`docs/FORMS-INTEGRATION.md`.

---

## What's already done

| File | Status |
|---|---|
| `schema/_contract.md` | Contract for the schema format. Read this. |
| `schema/*.json` | 8 form schemas (backflow, riser, fire pump, hydrant, 3 annual variants, combined). |
| `scripts/build-pdf-templates.mjs` | **PDF generator** — backflow_v1 is the worked sample. Pattern extends to the other 7. |
| `scripts/push-to-servicetrade.mjs` | **ServiceTrade uploader** — scaffolded with auth + upload, marked with `TODO` where API specifics need confirming. |
| `package.json` | `npm run pdf:build` + `npm run st:push` wired. `pdf-lib` added as dep. |
| `.env.local` | ServiceTrade env vars stubbed out (lines bottom of file). |

---

## What you need to do

### Step 1 — install pdf-lib

```
npm install
```

That picks up `pdf-lib` which was added to `package.json`.

### Step 2 — confirm the PDF generator works for backflow

```
npm run pdf:build backflow_v1
```

Expected output: `scripts/pdf-out/backflow_v1.pdf` containing 27 fillable
fields with the exact names from `schema/backflow.json`. Open it in Preview
or Acrobat to verify the AcroForm fields are there. The branding is RTF
navy/orange; layout is utilitarian — the goal is fidelity-of-fields, not
pixel-perfect visual match to the original.

Then build the rest:

```
npm run pdf:build
```

You'll get 8 PDFs (one per form_id) in `scripts/pdf-out/`.

### Step 3 — extend the PDF generator if needed

The current renderer groups fields by `schema.group` (a string like
"device_under_test", "control_valve_row", "system_row", "wet_systems", etc.)
and renders each group as a section. This works well for the simpler forms
(backflow, fire_pump). For the bigger ones (annual_inspection_v1 with 71
fields, fire_hydrant_v1 with 68 fields across 7 pages), you may want to:

- Add real table layout for the control-valve table, water-test table, and
  hydrant slots
- Use the schema's `notes` field for hints (e.g., "1 of 12 hydrant slots")
- Adjust the page break logic — current is "if y < margin + 30, new page"

But **the core contract is the AcroForm field name**. As long as the field
name on the PDF matches `schema.fields[].name`, ServiceTrade auto-fill works.
Visual polish is secondary.

### Step 4 — get the ServiceTrade credentials into `.env.local`

The user has API credentials for the ServiceTrade demo account. Open
`~/fire-protection-copilot/.env.local` and look for the ServiceTrade block.
Fill in:

- `SERVICETRADE_COMPANY_ID` — the demo company's ID (required)
- Then **pick one auth path**:
  - **Session auth** (easier): `SERVICETRADE_USERNAME` + `SERVICETRADE_PASSWORD`
  - **OAuth**: uncomment `SERVICETRADE_CLIENT_ID` + `SERVICETRADE_CLIENT_SECRET`

ServiceTrade's API docs are at https://api.servicetrade.com/api/docs (you
may need to log in to see them). Session auth is at `POST /auth`; OAuth is
at `POST /oauth/token`.

### Step 5 — confirm the upload endpoint with ServiceTrade's docs

The scaffolded uploader assumes the endpoint is `POST /api/documenttemplate`
with multipart-form body containing the PDF + `name` + `companyId`. **This
needs verification.** Look in ServiceTrade's API docs for:

- Document Template endpoints (likely under "Documents" or "Templates")
- Required fields beyond the file (type? appointment association?)
- Response shape (so we can print the template ID for confirmation)

If the endpoint or fields differ, edit `scripts/push-to-servicetrade.mjs`
around the `uploadTemplate` function. The `TODO` markers in that file
indicate exactly what to verify.

### Step 6 — push and verify

```
npm run st:push backflow_v1
```

Expected output:

```
Authenticating against https://api.servicetrade.com…
✓ auth ok (session)
✓ backflow_v1                 uploaded (id=12345)
```

Then in ServiceTrade's web UI (demo account):

1. Navigate to **Settings → Document Templates** (or wherever the demo
   surfaces them).
2. Find `backflow_v1`. Verify it's listed.
3. Attach it to a test job and generate the document — confirm the
   `servicetrade_*` header fields auto-fill from the job's location +
   technician + date.

That's the success criterion: **header auto-fills end-to-end without any
mapping work on the ServiceTrade side.**

### Step 7 — push the rest

```
npm run st:push
```

Uploads all 8 templates in one go.

---

## Tradeoffs and decisions you'll hit

### "Should I push the legacy / alt5 variants?"

The schema includes `annual_inspection_v1` (production with `servicetrade_*`
fields), `annual_inspection_legacy` (the PowerPoint version with `COMPANY` /
`STREET` / etc.), and `annual_inspection_alt5` (the Claude-rebuilt prototype).

For the demo, **only `annual_inspection_v1` matters** — that's the one with
the auto-fill merge fields. The other two are kept for completeness but
shouldn't be uploaded to a live ServiceTrade account.

Reasonable default: push `annual_inspection_v1`, `riser_v1`, `fire_pump_v1`,
`fire_hydrant_v1`, `backflow_v1`. Skip the others. (`combined_customer_v1`
is a deliverable wrapper, not an uploadable template.)

### "Should I associate templates with appointment types?"

ServiceTrade lets you tie a document template to specific job types so it
auto-attaches to new jobs. The scaffold doesn't do this — uploading the
template makes it available but doesn't wire it up. Whether to do that
association is a demo-decision. **Recommend: leave it manual for the demo,
add an auto-association step in a follow-up.**

### "The endpoint shape is different than the scaffold assumes."

Likely scenario. Edit the `uploadTemplate` function in
`scripts/push-to-servicetrade.mjs`. The auth code should be reusable; just
swap out the endpoint URL, body shape, and field names.

If the error is auth-related (401/403), confirm:
- The base URL is right (try `https://api.servicetrade.com` vs a demo
  subdomain)
- The session cookie is being sent (the scaffold uses `Cookie:` header — some
  endpoints want it as a credential cookie instead)

### "The PDF generator output looks ugly."

That's expected for a v1. The priority is field-name fidelity, not visual
polish. If RTF wants a prettier rebuild later, the renderer in
`build-pdf-templates.mjs` is the only file to touch — schemas don't change.

---

## Success criteria (verify all of these)

- [ ] `npm run pdf:build` produces 8 PDFs in `scripts/pdf-out/`
- [ ] Opening `backflow_v1.pdf` in a PDF reader shows fillable fields
- [ ] Field names on the PDF (visible in any AcroForm inspector) match
      `schema/backflow.json` exactly, e.g. `servicetrade_location_name`,
      `DEVICE`, `Initial Reading PSI`
- [ ] `npm run st:push backflow_v1` uploads without error
- [ ] In ServiceTrade demo UI, the template appears under Document Templates
- [ ] Attaching the template to a test job auto-fills the header section
      (company, location, date, technician) without any ST-side configuration

---

## If you get stuck

1. **PDF generation errors** → check `scripts/build-pdf-templates.mjs`,
   probably a field with an unusual `data_type` (`enum`, `triplet` variants).
2. **Auth errors** → confirm with ST docs which auth method the demo account
   uses. Print the response body to see ST's actual error message.
3. **Upload accepted but template doesn't appear in UI** → the endpoint
   might be right but `type` or some other required field is wrong. Check
   ST docs for "Document Template Type" enum values.
4. **Auto-fill doesn't work after manual attach** → the field name on the
   PDF doesn't match what ST expects. Open the uploaded PDF, inspect the
   AcroForm field names with a tool like `pdftk PDF dump_data_fields`, and
   compare against ST's documented merge fields.

---

## What NOT to do

- **Don't modify `/schema/*.json`.** Those are the source of truth.
- **Don't modify `lib/db/*` or any of the app code.** This task is
  PDF generation + ST upload only.
- **Don't push to RTF's production ServiceTrade account.** Demo account only.
- **Don't commit credentials.** The `.env.local` is in `.gitignore`.

---

## Reporting back

When you're done, write a short note to `docs/SERVICETRADE-INTEGRATION-RESULTS.md`
with:

- What worked
- What needed to change from the scaffold
- The actual ST endpoint + auth shape you used (for our records)
- Any templates that failed to upload + why
- Screenshot or text confirmation of auto-fill working in the demo UI

That doc becomes the next session's starting point.
