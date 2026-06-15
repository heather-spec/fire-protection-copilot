// =====================================================================
// Template loader
// =====================================================================
// Reads /schema/*.json (the form schemas produced by Agent A) and upserts
// one row per form_id into the inspection_templates table. The full JSON
// blob is stored in schema_json so every downstream consumer (print
// templates, completeness checker, auto-fill) reads from one canonical
// structure.
//
// Intended call site: scripts/load-templates.mjs (lead/dev runs after
// applying migration 0005). Node-only — uses fs.
// =====================================================================

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InspectionFormSchema } from "@/lib/db/types";

export interface LoadTemplatesResult {
  loaded: number;
  skipped: string[];
  loadedFormIds: string[];
}

/**
 * Walks `schemaDir`, picks every top-level *.json that isn't a manifest
 * (index.json) or partial (filenames starting with "_"), validates the
 * shape minimally, and upserts into inspection_templates by form_id.
 *
 * Idempotent: re-running updates schema_json + form_name in place.
 */
export async function loadTemplatesFromSchemaDir(
  schemaDir: string,
): Promise<LoadTemplatesResult> {
  const files = readdirSync(schemaDir).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_") && f !== "index.json",
  );

  const supabase = createSupabaseAdminClient();
  const skipped: string[] = [];
  const loadedFormIds: string[] = [];

  for (const file of files) {
    const fullPath = join(schemaDir, file);
    let json: InspectionFormSchema;
    try {
      json = JSON.parse(readFileSync(fullPath, "utf8")) as InspectionFormSchema;
    } catch (err) {
      skipped.push(`${file} (parse error: ${(err as Error).message})`);
      continue;
    }

    if (!json.form_id || !json.form_name) {
      skipped.push(`${file} (missing form_id or form_name)`);
      continue;
    }

    // supabase-js inserts type-resolve as `never[]` in our hand-rolled
    // Database shape — same workaround as lib/db/audit.ts.
    const writeClient = supabase as unknown as {
      from: (t: string) => {
        upsert: (
          row: Record<string, unknown>,
          opts?: { onConflict?: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await writeClient.from("inspection_templates").upsert(
      {
        form_id: json.form_id,
        form_name: json.form_name,
        nfpa_standard: json.nfpa_standard ?? null,
        rtf_form_version: json.rtf_form_version ?? null,
        page_count: json.page_count ?? 1,
        schema_json: json,
        is_active: true,
      },
      { onConflict: "form_id" },
    );

    if (error) {
      skipped.push(`${file} (upsert error: ${error.message})`);
      continue;
    }
    loadedFormIds.push(json.form_id);
  }

  return {
    loaded: loadedFormIds.length,
    skipped,
    loadedFormIds,
  };
}
