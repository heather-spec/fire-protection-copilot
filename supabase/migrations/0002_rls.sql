-- =====================================================================
-- Migration 0002: Row-Level Security
-- =====================================================================
-- Strategy:
--   * Every tenant-scoped table enables RLS and has policies keyed off
--     two SECURITY DEFINER helper functions that read from memberships.
--   * Helpers are SECURITY DEFINER so they can read memberships even
--     when the caller's own SELECT policy on memberships would be
--     recursive. We pin search_path to public for safety.
--   * Roles: 'admin' (full control), 'reviewer' (read all + change
--     review status), 'technician' (own work + read org).
-- =====================================================================

-- ---------- helpers ----------

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.profile_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.profile_id = auth.uid()
      and m.role = any(allowed)
  );
$$;

create or replace function public.current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.memberships where profile_id = auth.uid();
$$;

revoke all on function public.is_org_member(uuid)        from public;
revoke all on function public.has_org_role(uuid, user_role[]) from public;
revoke all on function public.current_user_org_ids()     from public;
grant execute on function public.is_org_member(uuid)        to authenticated;
grant execute on function public.has_org_role(uuid, user_role[]) to authenticated;
grant execute on function public.current_user_org_ids()     to authenticated;

-- ---------- enable RLS ----------

alter table organizations              enable row level security;
alter table profiles                   enable row level security;
alter table memberships                enable row level security;
alter table customers                  enable row level security;
alter table sites                      enable row level security;
alter table assets                     enable row level security;
alter table work_records               enable row level security;
alter table work_record_observations   enable row level security;
alter table deficiencies               enable row level security;
alter table deficiency_updates         enable row level security;
alter table attachments                enable row level security;
alter table audit_logs                 enable row level security;

-- =====================================================================
-- organizations
-- =====================================================================
create policy "org members can read their org"
on organizations for select to authenticated
using ( public.is_org_member(id) );

create policy "org admins can update their org"
on organizations for update to authenticated
using  ( public.has_org_role(id, array['admin']::user_role[]) )
with check ( public.has_org_role(id, array['admin']::user_role[]) );

-- Creation of orgs happens server-side (service-role) during onboarding;
-- no INSERT policy for normal users at MVP.

-- =====================================================================
-- profiles
-- =====================================================================
create policy "users can read own profile"
on profiles for select to authenticated
using ( id = auth.uid() );

create policy "users can read profiles of org-mates"
on profiles for select to authenticated
using (
  exists (
    select 1
    from memberships m1
    join memberships m2 on m1.org_id = m2.org_id
    where m1.profile_id = auth.uid()
      and m2.profile_id = profiles.id
  )
);

create policy "users can update own profile"
on profiles for update to authenticated
using  ( id = auth.uid() )
with check ( id = auth.uid() );

-- =====================================================================
-- memberships
-- =====================================================================
create policy "users can read memberships in their orgs"
on memberships for select to authenticated
using ( org_id in (select public.current_user_org_ids()) );

create policy "admins can manage memberships"
on memberships for all to authenticated
using     ( public.has_org_role(org_id, array['admin']::user_role[]) )
with check ( public.has_org_role(org_id, array['admin']::user_role[]) );

-- =====================================================================
-- generic per-org policies (customers, sites, assets, attachments, audit)
-- =====================================================================

-- customers
create policy "members read customers"
on customers for select to authenticated
using ( public.is_org_member(org_id) );

create policy "admins/reviewers write customers"
on customers for all to authenticated
using     ( public.has_org_role(org_id, array['admin','reviewer']::user_role[]) )
with check ( public.has_org_role(org_id, array['admin','reviewer']::user_role[]) );

-- sites
create policy "members read sites"
on sites for select to authenticated
using ( public.is_org_member(org_id) );

create policy "admins/reviewers write sites"
on sites for all to authenticated
using     ( public.has_org_role(org_id, array['admin','reviewer']::user_role[]) )
with check ( public.has_org_role(org_id, array['admin','reviewer']::user_role[]) );

-- assets
create policy "members read assets"
on assets for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write assets"
on assets for all to authenticated
using     ( public.is_org_member(org_id) )
with check ( public.is_org_member(org_id) );

-- =====================================================================
-- work_records
-- =====================================================================
create policy "members read work_records"
on work_records for select to authenticated
using ( public.is_org_member(org_id) );

-- Technicians (and above) can create drafts in their org
create policy "members insert work_records"
on work_records for insert to authenticated
with check ( public.is_org_member(org_id) );

-- Technicians can update their own DRAFT records.
-- Reviewers and admins can update any record in the org (status changes etc).
create policy "tech updates own draft, reviewer/admin updates any"
on work_records for update to authenticated
using (
  public.has_org_role(org_id, array['reviewer','admin']::user_role[])
  or (technician_id = auth.uid() and status = 'draft')
)
with check (
  public.has_org_role(org_id, array['reviewer','admin']::user_role[])
  or (technician_id = auth.uid() and status in ('draft','submitted'))
);

create policy "admins delete work_records"
on work_records for delete to authenticated
using ( public.has_org_role(org_id, array['admin']::user_role[]) );

-- =====================================================================
-- work_record_observations
-- =====================================================================
create policy "members read observations"
on work_record_observations for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write observations"
on work_record_observations for all to authenticated
using     ( public.is_org_member(org_id) )
with check ( public.is_org_member(org_id) );

-- =====================================================================
-- deficiencies
-- =====================================================================
create policy "members read deficiencies"
on deficiencies for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write deficiencies"
on deficiencies for all to authenticated
using     ( public.is_org_member(org_id) )
with check ( public.is_org_member(org_id) );

create policy "members read deficiency_updates"
on deficiency_updates for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write deficiency_updates"
on deficiency_updates for insert to authenticated
with check ( public.is_org_member(org_id) );

-- =====================================================================
-- attachments
-- =====================================================================
create policy "members read attachments"
on attachments for select to authenticated
using ( public.is_org_member(org_id) );

create policy "members write attachments"
on attachments for all to authenticated
using     ( public.is_org_member(org_id) )
with check ( public.is_org_member(org_id) );

-- =====================================================================
-- audit_logs   (read = admin/reviewer; insert = any member)
-- =====================================================================
create policy "admins/reviewers read audit"
on audit_logs for select to authenticated
using ( public.has_org_role(org_id, array['admin','reviewer']::user_role[]) );

create policy "members insert audit"
on audit_logs for insert to authenticated
with check ( public.is_org_member(org_id) );
