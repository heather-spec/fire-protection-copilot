-- =====================================================================
-- Migration 0004: jurisdictions + code amendments
-- =====================================================================
-- Adds the data model that lets the app emit jurisdiction-correct code
-- references (e.g. Ohio Fire Code 904.3.4.2 instead of NFPA 25 8.3.2.4
-- on an Ohio site).
--
-- Jurisdictions are global reference data — not org-scoped. Any
-- authenticated user can read them. Writes are admin-only (or via
-- service role / seed file).
-- =====================================================================

-- ---------- jurisdictions ----------
create table if not exists jurisdictions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,            -- "Cincinnati Fire Dept" or "Ohio (State)"
  jurisdiction_type text not null check (jurisdiction_type in ('state','county','city','federal')),
  state             text not null,            -- ISO state code, e.g. "OH"
  county            text,
  city              text,
  parent_id         uuid references jurisdictions(id) on delete set null,
  -- which edition of each NFPA standard this AHJ has currently adopted
  nfpa_editions     jsonb not null default '{}'::jsonb,
  adopted_code      text,                     -- "Ohio Fire Code 2021"
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists jurisdictions_state_idx on jurisdictions(state);
create index if not exists jurisdictions_type_idx  on jurisdictions(jurisdiction_type);
create index if not exists jurisdictions_parent_idx on jurisdictions(parent_id);
create unique index if not exists jurisdictions_unique_idx
  on jurisdictions(state, jurisdiction_type, coalesce(county,''), coalesce(city,''));

-- ---------- code_amendments ----------
-- How a particular jurisdiction's adopted code differs from the
-- national standard for a specific reference.
create table if not exists code_amendments (
  id                  uuid primary key default gen_random_uuid(),
  jurisdiction_id     uuid not null references jurisdictions(id) on delete cascade,
  source_ref          text not null,                 -- "NFPA 25 8.3.2.4"
  local_ref           text,                          -- "OFC 904.3.4.2"
  frequency_override  text,                          -- e.g. "annual" if local rule changes frequency
  description         text,
  notes               text,
  created_at          timestamptz not null default now()
);
create index if not exists code_amendments_jx_idx on code_amendments(jurisdiction_id);
create index if not exists code_amendments_source_idx on code_amendments(source_ref);

-- ---------- sites: link to jurisdiction ----------
alter table sites
  add column if not exists jurisdiction_id uuid references jurisdictions(id) on delete set null;
create index if not exists sites_jurisdiction_idx on sites(jurisdiction_id);

-- ---------- RLS ----------
alter table jurisdictions    enable row level security;
alter table code_amendments  enable row level security;

drop policy if exists "all authenticated read jurisdictions" on jurisdictions;
create policy "all authenticated read jurisdictions"
on jurisdictions for select to authenticated
using (true);

drop policy if exists "all authenticated read code_amendments" on code_amendments;
create policy "all authenticated read code_amendments"
on code_amendments for select to authenticated
using (true);

-- Writes are intentionally NOT exposed to authenticated users at MVP.
-- Service role bypasses RLS for seeds and admin tooling.

-- ---------- updated_at triggers ----------
do $$ begin
  drop trigger if exists set_updated_at on jurisdictions;
  create trigger set_updated_at before update on jurisdictions
  for each row execute function public.set_updated_at();
end $$;
