#!/usr/bin/env node
// scripts/load-inspection-templates.mjs
//
// One-shot loader: reads every form schema JSON in /schema/ (skipping files
// that start with "_" and skipping index.json) and upserts one row per form
// into the `inspection_templates` table, keyed by `form_id`.
//
// The full schema document is stored verbatim in `schema_json` so the app can
// drive print templates, completeness checks, and ServiceTrade merge mapping
// off the same single source of truth that Agent A publishes.
//
// Run with:
//   node scripts/load-inspection-templates.mjs
//
// Idempotent — safe to re-run after Agent A republishes any /schema/*.json.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// --- load .env.local (same pattern as fix-demo-users.mjs) ---
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

const schemaDir = resolve(process.cwd(), "schema");

let files;
try {
  files = readdirSync(schemaDir).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_") && f !== "index.json",
  );
} catch (e) {
  console.error(`✗ Cannot read schema dir at ${schemaDir}: ${e.message}`);
  process.exit(1);
}

if (!files.length) {
  console.warn(`! No schema files found in ${schemaDir}`);
  process.exit(0);
}

console.log(`→ Loading ${files.length} schema file(s) from ${schemaDir}\n`);

let loaded = 0;
let skipped = 0;
let failed = 0;

for (const file of files.sort()) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(schemaDir, file), "utf8"));
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON (${e.message})`);
    failed++;
    continue;
  }

  if (!json.form_id) {
    console.warn(`! ${file}: missing form_id, skipping`);
    skipped++;
    continue;
  }

  const row = {
    form_id: json.form_id,
    form_name: json.form_name ?? json.form_id,
    nfpa_standard: json.nfpa_standard ?? null,
    rtf_form_version: json.rtf_form_version ?? null,
    page_count: json.page_count ?? 1,
    schema_json: json,
    is_active: true,
  };

  const { error } = await supabase
    .from("inspection_templates")
    .upsert(row, { onConflict: "form_id" });

  if (error) {
    console.error(`✗ ${file} (${json.form_id}): ${error.message}`);
    failed++;
    continue;
  }

  const fieldCount = Array.isArray(json.fields) ? json.fields.length : 0;
  console.log(`✓ ${json.form_id.padEnd(28)} (${file}, ${fieldCount} fields)`);
  loaded++;
}

console.log("\n────────────────────────────────────────");
console.log(`Loaded:  ${loaded}`);
console.log(`Skipped: ${skipped}`);
console.log(`Failed:  ${failed}`);
console.log("────────────────────────────────────────");

if (failed > 0) process.exit(1);
