#!/usr/bin/env node
/**
 * Upload built PDF templates into a ServiceTrade demo account.
 *
 * EXPECTS:
 *   - scripts/pdf-out/<form_id>.pdf  (run build-pdf-templates.mjs first)
 *   - .env.local with ST credentials (see below)
 *
 * VERIFIED against the live ServiceTrade OpenAPI spec + demo account (2026-06-11):
 *   - Auth: OAuth2 client credentials at POST /api/oauth2/token
 *     (the legacy /oauth/token path does not exist)
 *   - There is NO /documenttemplate endpoint in the API. Fillable blank forms
 *     in ServiceTrade are attachments with purposeId=10 ("Blank Paperwork")
 *     on a job (entityType=3). ServiceTrade merges job/location/tech data
 *     into the PDF's servicetrade_* AcroForm fields when the paperwork is
 *     opened/generated in the app.
 *   - Upload: POST /api/attachment as multipart/form-data; the file field
 *     MUST be named `uploadedFile` (per the spec, this is the one endpoint
 *     that is not application/json).
 *
 * Constants (from the spec's "Attachment Purposes" / "Entity Types" tables):
 *   purposeId 10 = Blank Paperwork      entityType 3 = Job
 *
 * Run:
 *   node scripts/push-to-servicetrade.mjs              # push the 5 production forms
 *   node scripts/push-to-servicetrade.mjs backflow_v1  # push one
 *   node scripts/push-to-servicetrade.mjs backflow_v1 --job 123456  # override target job
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Env loader
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const ST_BASE_URL = env.SERVICETRADE_BASE_URL || "https://api.servicetrade.com";
const ST_CLIENT_ID = env.SERVICETRADE_CLIENT_ID;
const ST_CLIENT_SECRET = env.SERVICETRADE_CLIENT_SECRET;

const jobFlagIdx = process.argv.indexOf("--job");
const ST_TEST_JOB_ID =
  jobFlagIdx > -1 ? process.argv[jobFlagIdx + 1] : env.SERVICETRADE_TEST_JOB_ID;

if (!ST_CLIENT_ID || !ST_CLIENT_SECRET) {
  console.error("Missing SERVICETRADE_CLIENT_ID / SERVICETRADE_CLIENT_SECRET in .env.local");
  process.exit(1);
}
if (!ST_TEST_JOB_ID) {
  console.error("Missing SERVICETRADE_TEST_JOB_ID in .env.local (or pass --job <id>)");
  process.exit(1);
}

// Attachment constants per the ServiceTrade OpenAPI spec
const PURPOSE_BLANK_PAPERWORK = 10;
const ENTITY_TYPE_JOB = 3;

// Only these carry servicetrade_* merge fields; legacy/alt5/combined stay local.
const PRODUCTION_FORMS = [
  "annual_inspection_v1",
  "riser_v1",
  "fire_pump_v1",
  "fire_hydrant_v1",
  "backflow_v1",
];

// ---------------------------------------------------------------------------
// Auth — OAuth2 client credentials (verified working against the demo account)
// ---------------------------------------------------------------------------
async function authenticate() {
  const res = await fetch(`${ST_BASE_URL}/api/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: ST_CLIENT_ID,
      client_secret: ST_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`OAuth failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { token: json.access_token };
}

// ---------------------------------------------------------------------------
// Upload one PDF as Blank Paperwork on the test job
// ---------------------------------------------------------------------------
async function uploadTemplate(session, formId, pdfPath) {
  const buffer = readFileSync(pdfPath);
  const formData = new FormData();
  formData.append(
    "uploadedFile",
    new Blob([buffer], { type: "application/pdf" }),
    `${formId}.pdf`,
  );
  formData.append("purposeId", String(PURPOSE_BLANK_PAPERWORK));
  formData.append("entityType", String(ENTITY_TYPE_JOB));
  formData.append("entityId", String(ST_TEST_JOB_ID));
  formData.append("description", `${formId} — schema-generated fillable template (no PowerPoint)`);

  const res = await fetch(`${ST_BASE_URL}/api/attachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

// ---------------------------------------------------------------------------
// Post-push verification — list the job's attachments and confirm presence
// ---------------------------------------------------------------------------
async function listJobAttachments(session) {
  const res = await fetch(
    `${ST_BASE_URL}/api/attachment?entityId=${ST_TEST_JOB_ID}&entityType=${ENTITY_TYPE_JOB}`,
    { headers: { Authorization: `Bearer ${session.token}` } },
  );
  if (!res.ok) throw new Error(`Verify failed: ${res.status}`);
  const json = await res.json();
  return json.data?.attachments ?? [];
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
const OUT_DIR = resolve(process.cwd(), "scripts/pdf-out");
const arg = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const allPdfs = readdirSync(OUT_DIR).filter((f) => f.endsWith(".pdf"));
const toPush = arg
  ? allPdfs.filter((f) => f === `${arg}.pdf`)
  : allPdfs.filter((f) => PRODUCTION_FORMS.includes(f.replace(".pdf", "")));

if (toPush.length === 0) {
  console.error("No PDFs to upload. Run `npm run pdf:build` first.");
  process.exit(1);
}

console.log(`Authenticating against ${ST_BASE_URL}…`);
const session = await authenticate();
console.log("✓ auth ok (oauth2 client credentials)");
console.log(`Target: job ${ST_TEST_JOB_ID}, purpose=Blank Paperwork(10)\n`);

const uploaded = [];
for (const file of toPush) {
  const formId = file.replace(".pdf", "");
  try {
    const result = await uploadTemplate(session, formId, join(OUT_DIR, file));
    uploaded.push({ formId, id: result?.id });
    console.log(`✓ ${formId.padEnd(28)} uploaded ${result?.id ? `(attachment id=${result.id})` : ""}`);
  } catch (e) {
    console.error(`✗ ${formId}: ${e.message}`);
  }
}

const atts = await listJobAttachments(session);
const blanks = atts.filter((a) => a.purpose === "Blank Paperwork");
console.log(
  `\nVerification: job ${ST_TEST_JOB_ID} now has ${atts.length} attachment(s), ` +
  `${blanks.length} Blank Paperwork:`,
);
for (const a of blanks) console.log(`   - ${a.fileName} (id=${a.id})`);
console.log(`\nDone. Uploaded ${uploaded.length}/${toPush.length} template(s) into ServiceTrade demo.`);
