-- =====================================================================
-- Migration 0005: inspection templates + readings
-- =====================================================================
-- Adds:
--   * inspection_templates  — one row per form_id (backflow_v1, riser_v1, ...)
--                             stores the full /schema/*.json blob so the
--                             app, printer, and completeness checker all
--                             read from one canonical structure.
--   * work_record_readings  — numeric measurements (PSI, GPM, RPM, deg F).
--                             Kept separate from work_record_observations
--                             because readings need structured numeric
--                             storage (sorts, ranges, downstream charts).
--   * work_records.template_form_id — which template a record uses, so
--                             the print component and validator know which
--                             schema to load. Nullable for backwards-compat
--                             with existing records.
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---------- inspection_templates ----------
create table if not exists inspection_templates (
  id               uuid primary key default gen_random_uuid(),
  form_id          text unique not null,        -- e.g. "backflow_v1"
  form_name        text not null,               -- e.g. "Backflow Device Test Report"
  nfpa_standard    text,                        -- e.g. "NFPA 25"
  rtf_form_version text,                        -- e.g. "7/2020" from PDF footer
  page_count       integer not null default 1,
  schema_json      jsonb not null,              -- full JSON from /schema/<file>.json
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists inspection_templates_form_id_idx
  on inspection_templates(form_id);

-- ---------- work_record_readings ----------
create table if not exists work_record_readings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  work_record_id uuid not null references work_records(id) on delete cascade,
  asset_id       uuid references assets(id) on delete set null,
  field_name     text not null,        -- schema field name, e.g. "Initial Reading PSI"
  group_key      text,                 -- schema group, e.g. "device_under_test"
  value_numeric  numeric,              -- the actual reading
  value_text     text,                 -- backup textual capture (e.g. "ND")
  unit           text,                 -- "PSI", "GPM", "RPM", "deg_F"
  taken_at       timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists work_record_readings_org_idx
  on work_record_readings(org_id);
create index if not exists work_record_readings_record_idx
  on work_record_readings(work_record_id);
create index if not exists work_record_readings_field_idx
  on work_record_readings(work_record_id, field_name);

-- ---------- work_records.template_form_id ----------
alter table work_records
  add column if not exists template_form_id text;

-- ---------- RLS ----------
alter table inspection_templates  enable row level security;
alter table work_record_readings  enable row level security;

-- inspection_templates: global reference data, any authenticated user reads.
drop policy if exists "all authenticated read inspection_templates"
  on inspection_templates;
create policy "all authenticated read inspection_templates"
on inspection_templates for select to authenticated using (true);

-- work_record_readings: tenant-scoped.
drop policy if exists "members read readings" on work_record_readings;
create policy "members read readings"
on work_record_readings for select to authenticated
using ( public.is_org_member(org_id) );

drop policy if exists "members write readings" on work_record_readings;
create policy "members write readings"
on work_record_readings for all to authenticated
using     ( public.is_org_member(org_id) )
with check ( public.is_org_member(org_id) );

-- ---------- updated_at trigger ----------
do $$ begin
  drop trigger if exists set_updated_at on inspection_templates;
  create trigger set_updated_at before update on inspection_templates
  for each row execute function public.set_updated_at();
end $$;
