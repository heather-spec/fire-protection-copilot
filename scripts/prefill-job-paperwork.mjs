#!/usr/bin/env node
/**
 * Generate a PER-JOB pre-filled inspection form and attach it to the job.
 *
 * This is the "custom report for each job" concept: rather than waiting for
 * ServiceTrade's merge engine (which fills only its fixed servicetrade_*
 * header list, and only via the Print / Generate Blank Paperwork flow), we
 * pull the job + location from the API and fill the AcroForm ourselves with
 * pdf-lib. The attached copy is filled THE MOMENT anyone opens it — no Print
 * flow required — and the same mechanism can fill ANY field we know
 * (equipment make/model/serial from asset records, last year's readings,
 * contract numbers), which ServiceTrade's native merge cannot do.
 *
 * Run:
 *   node scripts/prefill-job-paperwork.mjs <form_id> <jobId>
 *   node scripts/prefill-job-paperwork.mjs backflow_v1 2222888809272897
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ---------------------------------------------------------------------------
// Env loader (same shape as push-to-servicetrade.mjs)
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
const [formId, jobIdArg] = [process.argv[2], process.argv[3]];
const jobId = jobIdArg || env.SERVICETRADE_TEST_JOB_ID;

if (!formId || !jobId) {
  console.error("Usage: node scripts/prefill-job-paperwork.mjs <form_id> <jobId>");
  process.exit(1);
}

async function authenticate() {
  const res = await fetch(`${ST_BASE_URL}/api/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.SERVICETRADE_CLIENT_ID,
      client_secret: env.SERVICETRADE_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`OAuth failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function getJSON(token, path) {
  const res = await fetch(`${ST_BASE_URL}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()).data;
}

const fmtDate = (epoch) =>
  epoch ? new Date(epoch * 1000).toLocaleDateString("en-US") : "";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const token = await authenticate();
console.log("✓ auth ok");

const job = await getJSON(token, `/job/${jobId}`);
const loc = job.location?.id ? await getJSON(token, `/location/${job.location.id}`) : {};
const addr = loc.address ?? {};
console.log(`✓ job #${job.number} @ ${loc.name ?? "?"}`);

// Technicians: current appointment techs if any (jobs in `new` status have none)
const techs = (job.currentAppointment?.techs ?? [])
  .map((t) => t.name)
  .join(", ");

// The 8 servicetrade_* merge fields our schemas preserve — filled by US,
// from the same data ServiceTrade's own engine would use.
const values = {
  servicetrade_location_name: loc.name ?? "",
  servicetrade_location_street: addr.street ?? "",
  servicetrade_location_city: [addr.city, addr.state, addr.postalCode]
    .filter(Boolean)
    .join(", "),
  servicetrade_location_phone: loc.phoneNumber ?? "",
  servicetrade_location_email: loc.email ?? "",
  servicetrade_job_number: String(job.number ?? ""),
  servicetrade_job_dates: fmtDate(job.scheduledDate) || fmtDate(job.dueBy),
  servicetrade_job_technicians: techs,
};

// Fill the built template. Values are BURNED INTO THE PAGE (drawn as page
// content at the field's widget rectangle, form field removed) rather than
// set as field values: in-browser PDF previews — including ServiceTrade's —
// skip the annotation layer, so filled-but-not-burned values render as empty
// boxes there. Burned text renders everywhere and can't be edited; the
// remaining inspection fields stay interactive for the tech.
const pdfPath = resolve(process.cwd(), "scripts/pdf-out", `${formId}.pdf`);
const pdf = await PDFDocument.load(readFileSync(pdfPath));
const form = pdf.getForm();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const pages = pdf.getPages();

let filled = 0;
for (const [name, value] of Object.entries(values)) {
  if (!value) continue;
  let field;
  try {
    field = form.getTextField(name);
  } catch {
    continue; /* field not on this form — fine */
  }
  for (const widget of field.acroField.getWidgets()) {
    const rect = widget.getRectangle();
    const pageRef = widget.P();
    const page = pages.find((p) => p.ref === pageRef) ?? pages[0];
    page.drawText(value, {
      x: rect.x + 4,
      y: rect.y + rect.height / 2 - 3.5,
      size: 10,
      font,
      color: rgb(0.05, 0.05, 0.2),
    });
  }
  form.removeField(field);
  filled++;
}
console.log(`✓ burned ${filled} merge values into the page from API data`);

const outName = `${formId}__job${job.number}_prefilled.pdf`;
const bytes = await pdf.save();

// Attach to the job as Blank Paperwork (purposeId 10, entityType 3 = Job)
const fd = new FormData();
fd.append("uploadedFile", new Blob([bytes], { type: "application/pdf" }), outName);
fd.append("purposeId", "10");
fd.append("entityType", "3");
fd.append("entityId", String(jobId));
fd.append("description", `Per-job pre-filled ${formId} — generated via API, no merge flow needed`);

const res = await fetch(`${ST_BASE_URL}/api/attachment`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: fd,
});
if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
const att = (await res.json()).data;
console.log(`✓ ${outName} attached to job ${jobId} (attachment id=${att.id})`);
console.log("\nOpen this attachment in the ServiceTrade UI — the header is already filled.");
