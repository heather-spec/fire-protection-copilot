-- =====================================================================
-- Migration 0003: MVP feature additions
-- =====================================================================
-- Adds:
--   * 'revision_requested' work_record_status
--   * 'deficiency_followup' work_record_type
--   * deficiency_priority enum + new deficiency columns
--   * work_records narrative columns (notes, voice_transcript, final_report)
--   * site_contacts table
--   * report_versions table (versioned AI drafts + finals)
--   * ai_generations table (every AI call logged)
--   * RLS update so techs can edit work_records in 'revision_requested'
-- =====================================================================

-- ---------- enum extensions ----------
alter type work_record_status add value if not exists 'revision_requested' before 'approved';
alter type work_record_type   add value if not exists 'deficiency_followup' after 'service_call';

create type deficiency_priority as enum ('urgent','high','normal','low');

-- ---------- work_records new columns ----------
alter table work_records
  add column if not exists notes              text,
  add column if not exists voice_transcript   text,
  add column if not exists final_report       text,
  add column if not exists latest_ai_draft_id uuid,
  add column if not exists final_report_version integer not null default 0;

-- ---------- deficiencies new columns ----------
alter table deficiencies
  add column if not exists priority           deficiency_priority not null default 'normal',
  add column if not exists due_date           date,
  add column if not exists recommended_action text;

create index if not exists def_priority_idx on deficiencies(priority);
create index if not exists def_due_idx      on deficiencies(due_date);

-- ---------- site_contacts ----------
create table if not exists site_contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  site_id     uuid not null references sites(id)         on delete cascade,
  name        text not null,
  role        text,
  email       citext,
  phone       text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists site_contacts_org_idx  on site_contacts(org_id);
create index if not exists site_contacts_site_idx on site_contacts(site_id);

-- ---------- report_versions ----------
-- kind = 'ai_draft' | 'reviewer_edit' | 'finalized'
create table if not exists report_versions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  work_record_id  uuid not null references work_records(id) on delete cascade,
  version         integer not null,
  kind            text   not null check (kind in ('ai_draft','reviewer_edit','finalized')),
  content         text   not null,
  author_id       uuid references profiles(id) on delete set null,
  ai_generation_id uuid,                                 -- nullable FK, see add below
  created_at      timestamptz not null default now(),
  unique (work_record_id, version)
);
create index if not exists report_versions_record_idx on report_versions(work_record_id);
create index if not exists report_versions_org_idx    on report_versions(org_id);

-- ---------- ai_generations ----------
-- All AI calls are logged here for auditability.
-- target_kind = 'report_draft' | 'client_summary' | 'deficiency_extract' | ...
create table if not exists ai_generations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  target_table  text not null,           -- e.g. 'work_records'
  target_id     uuid not null,
  kind          text not null,
  provider      text not null,           -- 'mock' | 'anthropic' | 'openai'
  model         text not null,
  prompt        text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output        text not null,
  status        text not null default 'ok',
  error         text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists ai_generations_org_idx    on ai_generations(org_id);
create index if not exists ai_generations_target_idx on ai_generations(target_table, target_id);
create index if not exists ai_generations_kind_idx   on ai_generations(kind);

-- Now we can wire the FK on report_versions safely
alter table report_versions
  drop constraint if exists report_versions_ai_generation_fk;
alter table report_versions
  add constraint report_versions_ai_generation_fk
  foreign key (ai_generation_id) references ai_generations(id) on delete set null;

-- And on work_records.latest_ai_draft_id
alter table work_records
  drop constraint if exists work_records_latest_ai_draft_fk;
alter table work_records
  add constraint work_records_latest_ai_draft_fk
  foreign key (latest_ai_draft_id) references report_versions(id) on delete set null;

-- ---------- updated_at triggers for new tables ----------
-- (only site_contacts has an updated_at; others are append-only)
-- nothing to add

-- ---------- RLS for new tables ----------
alter table site_contacts    enable row level security;
alter table report_versions  enable row level security;
alter table ai_generations   enable row level security;

create policy "members read site_contacts"
on site_contacts for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write site_contacts"
on site_contacts for all to authenticated
using     ( public.is_org_member(org_id) )
with check ( public.is_org_member(org_id) );

create policy "members read report_versions"
on report_versions for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write report_versions"
on report_versions for all to authenticated
using     ( public.is_org_member(org_id) )
with check ( public.is_org_member(org_id) );

create policy "members read ai_generations"
on ai_generations for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write ai_generations"
on ai_generations for insert to authenticated
with check ( public.is_org_member(org_id) );

-- ---------- update work_records UPDATE policy to allow revision_requested ----------
drop policy if exists "tech updates own draft, reviewer/admin updates any" on work_records;
create policy "tech edits own draft/revision; reviewer/admin edits any"
on work_records for update to authenticated
using (
  public.has_org_role(org_id, array['reviewer','admin']::user_role[])
  or (technician_id = auth.uid() and status in ('draft','revision_requested'))
)
with check (
  public.has_org_role(org_id, array['reviewer','admin']::user_role[])
  or (technician_id = auth.uid() and status in ('draft','submitted','revision_requested'))
);
