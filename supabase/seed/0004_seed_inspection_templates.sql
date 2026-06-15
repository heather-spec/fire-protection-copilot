-- =====================================================================
-- Seed 0004: inspection templates
-- =====================================================================
-- This file is intentionally a no-op.
--
-- The inspection_templates table is populated by loading the JSON blobs
-- in /schema/*.json at runtime via lib/db/template-loader.ts (called from
-- a node script such as scripts/load-templates.mjs). Doing it in node lets
-- us read the schema files from disk and upsert one row per form_id with
-- the full JSON in schema_json, which would be brittle to hand-encode
-- inside a plain .sql seed.
--
-- This stub exists so the seed numbering stays contiguous (0002, 0003,
-- 0004) and the seed runner picks it up without error.
-- =====================================================================

select 1;
