-- =====================================================================
-- Fire Protection Compliance Copilot
-- Migration 0001: core schema
-- =====================================================================
-- Conventions:
--   * Every tenant-scoped table carries org_id uuid not null with an
--     index, and a foreign key to organizations(id) on delete cascade.
--   * Surrogate keys are uuid v4 via gen_random_uuid().
--   * Timestamps are timestamptz, defaulted to now().
--   * Soft-delete is intentionally NOT used at MVP; deletes are real.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'technician', 'reviewer');

create type work_record_type as enum (
  'inspection',
  'test',
  'maintenance',
  'service_call',
  'impairment',
  'fire_watch'
);

create type work_record_status as enum (
  'draft',
  'submitted',
  'in_review',
  'approved',
  'rejected'
);

create type asset_type as enum (
  'sprinkler_system',
  'fire_alarm_panel',
  'fire_pump',
  'standpipe',
  'extinguisher',
  'kitchen_hood',
  'emergency_lighting',
  'backflow_preventer',
  'hydrant',
  'smoke_detector',
  'heat_detector',
  'co_detector',
  'other'
);

create type deficiency_severity as enum ('critical', 'major', 'minor', 'advisory');
create type deficiency_status   as enum ('open', 'in_progress', 'resolved', 'wont_fix');

-- ---------------------------------------------------------------------
-- organizations  (tenant root)
-- ---------------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        citext not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null,
  full_name   text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- memberships  (which user belongs to which org, with role)
-- ---------------------------------------------------------------------
create table memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  profile_id  uuid not null references profiles(id)      on delete cascade,
  role        user_role not null default 'technician',
  created_at  timestamptz not null default now(),
  unique (org_id, profile_id)
);
create index memberships_profile_idx on memberships(profile_id);
create index memberships_org_idx     on memberships(org_id);

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table customers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  contact_name    text,
  contact_email   citext,
  contact_phone   text,
  billing_address text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index customers_org_idx on customers(org_id);

-- ---------------------------------------------------------------------
-- sites  (one customer can have many physical sites)
-- ---------------------------------------------------------------------
create table sites (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  customer_id     uuid not null references customers(id)     on delete cascade,
  name            text not null,
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  postal_code     text,
  occupancy_type  text,                -- e.g., "Business B", "Mercantile M"
  square_footage  integer,
  ahj             text,                -- authority having jurisdiction
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index sites_org_idx      on sites(org_id);
create index sites_customer_idx on sites(customer_id);

-- ---------------------------------------------------------------------
-- assets  (the physical pieces of fire protection equipment on a site)
-- ---------------------------------------------------------------------
create table assets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  site_id          uuid not null references sites(id)         on delete cascade,
  asset_type       asset_type not null,
  identifier       text,        -- panel ID, sprinkler riser number, extinguisher tag, etc.
  manufacturer     text,
  model            text,
  serial_number    text,
  installed_on     date,
  last_serviced_on date,
  location_note    text,        -- "rear stockroom, north wall"
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index assets_org_idx        on assets(org_id);
create index assets_site_idx       on assets(site_id);
create index assets_type_idx       on assets(asset_type);

-- ---------------------------------------------------------------------
-- work_records  (inspection / test / maintenance / service / impairment / fire_watch)
-- ---------------------------------------------------------------------
create table work_records (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  site_id            uuid not null references sites(id)         on delete cascade,
  customer_id        uuid not null references customers(id)     on delete cascade,
  record_type        work_record_type not null,
  status             work_record_status not null default 'draft',
  reference_code     text,    -- human-readable, e.g. "INSP-2026-0142"
  scheduled_for      timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,
  technician_id      uuid references profiles(id) on delete set null,
  reviewer_id        uuid references profiles(id) on delete set null,
  summary            text,
  metadata           jsonb not null default '{}'::jsonb,  -- standard, frequency, equipment list, fire-watch schedule, impairment dates
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  rejection_reason   text
);
create index work_records_org_idx        on work_records(org_id);
create index work_records_site_idx       on work_records(site_id);
create index work_records_customer_idx   on work_records(customer_id);
create index work_records_status_idx     on work_records(status);
create index work_records_type_idx       on work_records(record_type);
create index work_records_completed_idx  on work_records(completed_at desc nulls last);

-- ---------------------------------------------------------------------
-- work_record_observations  (line items: per-asset, per-check)
-- ---------------------------------------------------------------------
create table work_record_observations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  work_record_id    uuid not null references work_records(id)  on delete cascade,
  asset_id          uuid references assets(id) on delete set null,
  check_code        text,                       -- NFPA reference, e.g. "NFPA25 5.2.1.1"
  description       text not null,
  result            text not null,              -- 'pass', 'fail', 'na', etc.
  notes             text,
  created_at        timestamptz not null default now()
);
create index obs_org_idx     on work_record_observations(org_id);
create index obs_record_idx  on work_record_observations(work_record_id);
create index obs_asset_idx   on work_record_observations(asset_id);

-- ---------------------------------------------------------------------
-- deficiencies
-- ---------------------------------------------------------------------
create table deficiencies (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  site_id             uuid not null references sites(id)         on delete cascade,
  work_record_id      uuid references work_records(id) on delete set null,
  asset_id            uuid references assets(id)       on delete set null,
  observation_id      uuid references work_record_observations(id) on delete set null,
  severity            deficiency_severity not null default 'minor',
  status              deficiency_status   not null default 'open',
  title               text not null,
  description         text,
  code_reference      text,    -- "NFPA 72 14.4.5"
  discovered_on       date not null default current_date,
  resolved_on         date,
  estimated_cost      numeric(10,2),
  assigned_to         uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index def_org_idx       on deficiencies(org_id);
create index def_site_idx      on deficiencies(site_id);
create index def_status_idx    on deficiencies(status);
create index def_severity_idx  on deficiencies(severity);
create index def_record_idx    on deficiencies(work_record_id);

-- ---------------------------------------------------------------------
-- deficiency_updates  (timeline of state changes / comments)
-- ---------------------------------------------------------------------
create table deficiency_updates (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  deficiency_id   uuid not null references deficiencies(id) on delete cascade,
  author_id       uuid references profiles(id) on delete set null,
  body            text not null,
  from_status     deficiency_status,
  to_status       deficiency_status,
  created_at      timestamptz not null default now()
);
create index def_update_org_idx on deficiency_updates(org_id);
create index def_update_def_idx on deficiency_updates(deficiency_id);

-- ---------------------------------------------------------------------
-- attachments  (polymorphic: photos, PDFs, signed reports)
-- ---------------------------------------------------------------------
create table attachments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  related_table   text not null,        -- 'work_records' | 'deficiencies' | 'assets' | 'sites'
  related_id      uuid not null,
  storage_path    text not null,        -- supabase storage object path
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index attachments_org_idx     on attachments(org_id);
create index attachments_related_idx on attachments(related_table, related_id);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  actor_id      uuid references profiles(id) on delete set null,
  action        text not null,             -- 'create' | 'update' | 'submit' | 'approve' | 'reject' | 'resolve' | ...
  target_table  text not null,
  target_id     uuid,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_org_idx     on audit_logs(org_id);
create index audit_target_idx  on audit_logs(target_table, target_id);
create index audit_created_idx on audit_logs(created_at desc);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'organizations','profiles','customers','sites','assets',
      'work_records','deficiencies'
    ])
  loop
    execute format(
      'drop trigger if exists set_updated_at on %I;
       create trigger set_updated_at before update on %I
       for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end$$;
