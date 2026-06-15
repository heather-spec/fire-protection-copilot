#!/usr/bin/env node
// scripts/seed-ryder.mjs
//
// Loads the anonymized Ryder demo data into the demo org. The data lives in
// `scripts/_ryder_fixtures.json` (the JSON file is the source of truth; this
// script is just a loader). All IDs are deterministic so the script is
// idempotent — running it twice will upsert, not duplicate.
//
// What gets seeded into org aaaaaaaa-...:
//   - 1 customer (Sample Distribution Center)
//   - 1 site (Sample DC - Hebron)
//   - ~25 assets: main pump + jockey + motor, 4" Wilkins RPZ backflow,
//     8 Kennedy hydrants, 15 sprinkler systems
//   - 6 work records: 1 annual, 1 riser, 1 fire pump, 1 hydrant, 1 backflow
//     (all submitted, anonymized 5/28/2026 inspection), plus 1 INCOMPLETE
//     fire-pump test (the "Mike" record) whose peak flow-test row is
//     intentionally half-filled — this is the canonical test case for
//     Agent D's completeness checker.
//
// Run with:
//   node scripts/seed-ryder.mjs
//
// Prereqs:
//   - .env.local has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   - Demo org + demo profiles already exist (see seed.sql / fix-demo-users.mjs)
//   - inspection_templates table populated via load-inspection-templates.mjs
//     (work_records.template_form_id references those rows)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- load .env.local ---
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Demo IDs — match the seed.sql constants used elsewhere in the repo.
const ORG_ID      = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TECH_ID     = "33333333-3333-3333-3333-333333333333"; // Tomas Tech
const REVIEWER_ID = "22222222-2222-2222-2222-222222222222"; // Rita Reviewer

// Load the anonymized fixture data.
const fixturesPath = resolve(process.cwd(), "scripts/_ryder_fixtures.json");
let data;
try {
  data = JSON.parse(readFileSync(fixturesPath, "utf8"));
} catch (e) {
  console.error(`✗ Cannot read fixtures at ${fixturesPath}: ${e.message}`);
  process.exit(1);
}

// --- small helper to bail loudly on FK / RLS / schema mismatches ---
function check(label, error) {
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
}

// 1. Customer ---------------------------------------------------------------
{
  const { error } = await supabase
    .from("customers")
    .upsert(
      {
        id: data.customer.id,
        org_id: ORG_ID,
        name: data.customer.name,
        contact_name: data.customer.contact_name,
        contact_email: data.customer.contact_email,
        contact_phone: data.customer.contact_phone,
        billing_address: data.customer.billing_address,
      },
      { onConflict: "id" },
    );
  check(`customer ${data.customer.name}`, error);
}

// 2. Site -------------------------------------------------------------------
{
  const { error } = await supabase
    .from("sites")
    .upsert(
      {
        id: data.site.id,
        org_id: ORG_ID,
        customer_id: data.customer.id,
        name: data.site.name,
        address_line1: data.site.address_line1,
        address_line2: data.site.address_line2 ?? null,
        city: data.site.city,
        state: data.site.state,
        postal_code: data.site.postal_code,
        occupancy_type: data.site.occupancy_type ?? null,
        square_footage: data.site.square_footage ?? null,
        notes: data.site.notes ?? null,
      },
      { onConflict: "id" },
    );
  check(`site ${data.site.name}`, error);
}

// 3. Assets -----------------------------------------------------------------
{
  const rows = data.assets.map((a) => ({
    id: a.id,
    org_id: ORG_ID,
    site_id: data.site.id,
    asset_type: a.asset_type,
    identifier: a.identifier,
    manufacturer: a.manufacturer ?? null,
    model: a.model ?? null,
    serial_number: a.serial_number ?? null,
    metadata: a.metadata ?? {},
  }));
  const { error } = await supabase.from("assets").upsert(rows, { onConflict: "id" });
  check(`${rows.length} assets`, error);
}

// 4. Work records + observations + readings ---------------------------------
//
// We delete + reinsert children (observations, readings) on every run so the
// counts stay clean. The parent work_records row is upserted by id so any
// downstream FKs (deficiencies, attachments, ai_generations) survive a re-run.
for (const wr of data.work_records) {
  const { observations = [], readings = [], ...rest } = wr;

  // Upsert the parent record.
  const recordRow = {
    id: rest.id,
    org_id: ORG_ID,
    customer_id: data.customer.id,
    site_id: data.site.id,
    technician_id: TECH_ID,
    reviewer_id: rest.status === "submitted" ? REVIEWER_ID : null,
    template_form_id: rest.template_form_id,
    record_type: rest.record_type ?? "inspection",
    status: rest.status ?? "draft",
    reference_code: rest.reference_code ?? null,
    scheduled_for: rest.scheduled_for ?? rest.scheduled_at ?? null,
    completed_at: rest.completed_at ?? null,
    summary: rest.summary ?? null,
    metadata: rest.metadata ?? {},
  };

  const { error: recErr } = await supabase
    .from("work_records")
    .upsert(recordRow, { onConflict: "id" });
  check(`work_record ${rest.reference_code ?? rest.id}`, recErr);

  // Clear children before reinserting (idempotent reseed).
  await supabase.from("work_record_observations").delete().eq("work_record_id", rest.id);
  await supabase.from("work_record_readings").delete().eq("work_record_id", rest.id);

  if (observations.length) {
    // observations table has no group_key column; carry group on notes instead
    const obsRows = observations.map((o) => ({
      org_id: ORG_ID,
      work_record_id: rest.id,
      check_code: o.check_code,
      description: o.description ?? "",
      result: o.result ?? "na",
      notes: o.notes ?? (o.group_key ? `group: ${o.group_key}` : null),
    }));
    const { error: obsErr } = await supabase
      .from("work_record_observations")
      .insert(obsRows);
    check(`  → ${obsRows.length} observations`, obsErr);
  }

  if (readings.length) {
    const readRows = readings.map((r) => ({
      org_id: ORG_ID,
      work_record_id: rest.id,
      field_name: r.field_name,
      value_numeric: r.value_numeric ?? null,
      value_text: r.value_text ?? null,
      unit: r.unit ?? null,
      group_key: r.group_key ?? null,
    }));
    const { error: readErr } = await supabase
      .from("work_record_readings")
      .insert(readRows);
    check(`  → ${readRows.length} readings`, readErr);
  }
}

console.log("\n────────────────────────────────────────");
console.log(`✓ Seeded demo org ${ORG_ID}`);
console.log(`  customer:     ${data.customer.name}`);
console.log(`  site:         ${data.site.name}`);
console.log(`  assets:       ${data.assets.length}`);
console.log(`  work_records: ${data.work_records.length}`);
const incomplete = data.work_records.filter((w) => w.status !== "submitted").length;
console.log(`    (of which ${incomplete} intentionally incomplete for Agent D)`);
console.log("────────────────────────────────────────");
