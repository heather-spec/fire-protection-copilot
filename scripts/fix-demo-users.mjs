#!/usr/bin/env node
// scripts/fix-demo-users.mjs
//
// Repairs the 4 demo accounts by going through Supabase's Auth Admin API
// instead of raw SQL. The Admin API knows every required auth.users column
// in the current Supabase schema, so it heals any inserts that failed via
// a hand-written seed.
//
// Run with:
//   node scripts/fix-demo-users.mjs
//
// Idempotent — safe to re-run.

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

const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const password = "DemoPass123!";

const users = [
  { id: "11111111-1111-1111-1111-111111111111", email: "admin@sentinel.demo",    name: "Alex Admin",     role: "admin" },
  { id: "22222222-2222-2222-2222-222222222222", email: "reviewer@sentinel.demo", name: "Rita Reviewer",  role: "reviewer" },
  { id: "33333333-3333-3333-3333-333333333333", email: "tech1@sentinel.demo",    name: "Tomas Tech",     role: "technician" },
  { id: "44444444-4444-4444-4444-444444444444", email: "tech2@sentinel.demo",    name: "Tasha Tech",     role: "technician" },
];

function isNotFound(err) {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return m.includes("not found") || m.includes("does not exist") || err.status === 404;
}

async function snapshotFkRefs(uid) {
  // Capture any FK refs to this user from tables that ON DELETE SET NULL,
  // so we can restore them after a delete+recreate cycle.
  const tables = [
    { table: "work_records",       col: "technician_id" },
    { table: "work_records",       col: "reviewer_id" },
    { table: "deficiencies",       col: "assigned_to" },
    { table: "deficiency_updates", col: "author_id" },
    { table: "report_versions",    col: "author_id" },
    { table: "audit_logs",         col: "actor_id" },
    { table: "ai_generations",     col: "created_by" },
    { table: "attachments",        col: "uploaded_by" },
  ];
  const snap = [];
  for (const { table, col } of tables) {
    const { data, error } = await supabase.from(table).select("id").eq(col, uid);
    if (error || !data?.length) continue;
    snap.push({ table, col, ids: data.map((r) => r.id) });
  }
  return snap;
}

async function restoreFkRefs(uid, snap) {
  for (const { table, col, ids } of snap) {
    if (!ids.length) continue;
    const { error } = await supabase.from(table).update({ [col]: uid }).in("id", ids);
    if (error) console.warn(`  ! could not restore ${table}.${col}: ${error.message}`);
  }
}

for (const u of users) {
  process.stdout.write(`\n→ ${u.email} (${u.id})\n`);

  // 1. Try to update in place first — preserves all FKs
  const { error: upErr } = await supabase.auth.admin.updateUserById(u.id, {
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.name },
  });

  if (!upErr) {
    console.log("  ✓ updated in place via Admin API");
  } else if (isNotFound(upErr)) {
    // 2a. User doesn't exist yet — create
    const { error: cErr } = await supabase.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (cErr) {
      console.error(`  ✗ create failed: ${cErr.message}`);
      continue;
    }
    console.log("  ✓ created via Admin API");
  } else {
    // 2b. Update failed for some other reason — recreate, restoring FK refs
    console.warn(`  ! update failed: ${upErr.message}. Recreating with FK rescue…`);
    const snap = await snapshotFkRefs(u.id);
    await supabase.auth.admin.deleteUser(u.id);
    const { error: cErr } = await supabase.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (cErr) {
      console.error(`  ✗ recreate failed: ${cErr.message}`);
      continue;
    }
    console.log("  ✓ recreated; restoring FK references…");
    await restoreFkRefs(u.id, snap);
  }

  // 3. Make sure profile + membership rows exist
  const { error: pErr } = await supabase.from("profiles").upsert({
    id: u.id,
    email: u.email,
    full_name: u.name,
  });
  if (pErr) console.warn(`  ! profile upsert: ${pErr.message}`);

  const { error: mErr } = await supabase.from("memberships").upsert(
    { org_id: ORG_ID, profile_id: u.id, role: u.role },
    { onConflict: "org_id,profile_id" },
  );
  if (mErr) console.warn(`  ! membership upsert: ${mErr.message}`);
  else console.log(`  ✓ membership: ${u.role}`);
}

console.log("\n────────────────────────────────────────");
console.log("Done. Try logging in:");
for (const u of users) console.log(`  ${u.email} / DemoPass123!`);
console.log("────────────────────────────────────────\n");
