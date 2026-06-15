-- =====================================================================
-- Seed data: one demo organization with realistic fire protection scenarios
-- =====================================================================
-- IMPORTANT: this seed is intended to run BEFORE any real auth users have
-- signed up. It writes directly to auth.users so demo logins work.
--
-- Run with:  psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Demo auth users.  Passwords are bcrypt-hashed "DemoPass123!"
-- (hash generated with `select crypt('DemoPass123!', gen_salt('bf'))`).
-- ---------------------------------------------------------------------
do $$
declare
  pw text := crypt('DemoPass123!', gen_salt('bf'));
  admin_id     uuid := '11111111-1111-1111-1111-111111111111';
  reviewer_id  uuid := '22222222-2222-2222-2222-222222222222';
  tech1_id     uuid := '33333333-3333-3333-3333-333333333333';
  tech2_id     uuid := '44444444-4444-4444-4444-444444444444';
begin
  insert into auth.users (id, instance_id, email, encrypted_password,
                          email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data)
  values
    (admin_id,    '00000000-0000-0000-0000-000000000000', 'admin@sentinel.demo',    pw, now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Admin"}'),
    (reviewer_id, '00000000-0000-0000-0000-000000000000', 'reviewer@sentinel.demo', pw, now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Rita Reviewer"}'),
    (tech1_id,    '00000000-0000-0000-0000-000000000000', 'tech1@sentinel.demo',    pw, now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Tomas Tech"}'),
    (tech2_id,    '00000000-0000-0000-0000-000000000000', 'tech2@sentinel.demo',    pw, now(), 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Tasha Tech"}')
  on conflict (id) do nothing;

  -- The trigger creates rows in public.profiles, but if it was disabled
  -- or ran in a prior partial seed, ensure rows exist:
  insert into public.profiles (id, email, full_name) values
    (admin_id,    'admin@sentinel.demo',    'Alex Admin'),
    (reviewer_id, 'reviewer@sentinel.demo', 'Rita Reviewer'),
    (tech1_id,    'tech1@sentinel.demo',    'Tomas Tech'),
    (tech2_id,    'tech2@sentinel.demo',    'Tasha Tech')
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name;

  -- IMPORTANT: Supabase Auth (GoTrue) requires a matching row in
  -- auth.identities for every auth.users row. Without this, login fails
  -- with "Database error querying schema". We insert one identity per
  -- seeded user, using the email provider.
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select
    u.id::text,
    u.id,
    jsonb_build_object(
      'sub', u.id::text,
      'email', u.email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  from auth.users u
  where u.id in (admin_id, reviewer_id, tech1_id, tech2_id)
  on conflict do nothing;
end$$;

-- ---------------------------------------------------------------------
-- Organization + memberships
-- ---------------------------------------------------------------------
insert into organizations (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sentinel Fire Protection', 'sentinel')
on conflict (id) do nothing;

insert into memberships (org_id, profile_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'reviewer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'technician'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'technician')
on conflict (org_id, profile_id) do nothing;

-- ---------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------
insert into customers (id, org_id, name, contact_name, contact_email, contact_phone, billing_address) values
  ('cccccc01-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Riverside Medical Center', 'Janice Holloway', 'jholloway@riverside.med', '317-555-0142',
   '1200 Wabash Ave, Indianapolis, IN 46202'),
  ('cccccc02-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Northgate Distribution Co.', 'Marcus Bell', 'marcus@northgate-dc.com', '317-555-0188',
   '4500 Logistics Pkwy, Whitestown, IN 46075'),
  ('cccccc03-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Maplewood School District', 'Priya Anand', 'panand@maplewoodsd.org', '317-555-0119',
   '88 Maple Ridge Rd, Carmel, IN 46032')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Sites
-- ---------------------------------------------------------------------
insert into sites (id, org_id, customer_id, name, address_line1, city, state, postal_code, occupancy_type, square_footage, ahj) values
  -- Riverside
  ('5e000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccc01-0000-0000-0000-000000000001',
   'Riverside Main Hospital', '1200 Wabash Ave', 'Indianapolis', 'IN', '46202', 'Institutional I-2', 384000, 'Indianapolis Fire Department'),
  ('5e000002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccc01-0000-0000-0000-000000000001',
   'Riverside Outpatient Clinic', '1244 Wabash Ave', 'Indianapolis', 'IN', '46202', 'Business B', 28000, 'Indianapolis Fire Department'),
  -- Northgate
  ('5e000003-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccc02-0000-0000-0000-000000000002',
   'Northgate DC #1', '4500 Logistics Pkwy', 'Whitestown', 'IN', '46075', 'Storage S-1', 540000, 'Whitestown FD'),
  ('5e000004-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccc02-0000-0000-0000-000000000002',
   'Northgate DC #2', '4520 Logistics Pkwy', 'Whitestown', 'IN', '46075', 'Storage S-1', 410000, 'Whitestown FD'),
  -- Maplewood
  ('5e000005-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccc03-0000-0000-0000-000000000003',
   'Maplewood High School', '88 Maple Ridge Rd', 'Carmel', 'IN', '46032', 'Educational E', 192000, 'Carmel FD')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------
insert into assets (org_id, site_id, asset_type, identifier, manufacturer, model, serial_number, installed_on, last_serviced_on, location_note) values
  -- Riverside Main
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001', 'fire_alarm_panel', 'FAP-01', 'Notifier',     'NFS2-3030',   'NF-22841',  '2019-04-10', '2026-02-14', 'Main switchgear room, level B1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001', 'fire_pump',        'FP-01',  'Patterson',    '8x6 HSC',     'PT-9921',   '2018-09-15', '2026-01-22', 'Pump room, north wing'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001', 'sprinkler_system', 'WET-N1', 'Viking',       'Wet System',  'VK-N1',     '2018-09-15', '2026-01-22', 'North wing risers'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001', 'sprinkler_system', 'WET-S1', 'Viking',       'Wet System',  'VK-S1',     '2018-09-15', '2026-01-22', 'South wing risers'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001', 'kitchen_hood',     'HOOD-1', 'Ansul',        'R-102',       'AN-4412',   '2020-06-01', '2026-03-04', 'Cafeteria kitchen'),
  -- Riverside Clinic
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000002-0000-0000-0000-000000000002', 'fire_alarm_panel', 'FAP-02', 'Notifier',     'NFS-320',     'NF-13301',  '2021-05-20', '2026-02-14', 'Mechanical closet 1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000002-0000-0000-0000-000000000002', 'extinguisher',     'EXT-12', 'Amerex',       'B500',        'AX-50122',  '2022-08-01', '2025-08-01', 'Lobby, near reception'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000002-0000-0000-0000-000000000002', 'emergency_lighting','EL-04', 'Lithonia',    'ELM2',        'LT-7700',   '2021-05-20', '2026-02-14', 'Exit corridor west'),
  -- Northgate DC #1
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003', 'fire_pump',        'FP-10', 'Aurora',        '481-BF',      'AR-31019',  '2017-03-12', '2026-04-01', 'Pump house exterior'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003', 'sprinkler_system', 'ESFR-A','Viking',        'ESFR K25',    'VK-A1',     '2017-04-01', '2026-04-01', 'High-pile storage area A'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003', 'sprinkler_system', 'ESFR-B','Viking',        'ESFR K25',    'VK-B1',     '2017-04-01', '2026-04-01', 'High-pile storage area B'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003', 'hydrant',          'HYD-N1','Mueller',       'A-423',       'MU-N1',     '2017-04-01', '2025-09-20', 'NW corner of property'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003', 'hydrant',          'HYD-S1','Mueller',       'A-423',       'MU-S1',     '2017-04-01', '2025-09-20', 'SE corner of property'),
  -- Northgate DC #2
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000004-0000-0000-0000-000000000004', 'sprinkler_system', 'ESFR-C','Viking',        'ESFR K25',    'VK-C1',     '2019-11-30', '2026-04-01', 'Main warehouse'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000004-0000-0000-0000-000000000004', 'fire_alarm_panel', 'FAP-03','Simplex',       '4100ES',      'SX-22118',  '2019-11-30', '2026-03-01', 'Office area, room 14'),
  -- Maplewood HS
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000005-0000-0000-0000-000000000005', 'fire_alarm_panel', 'FAP-04','Edwards',       'EST3X',       'ED-7710',   '2015-08-15', '2026-02-28', 'Main office IDF'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000005-0000-0000-0000-000000000005', 'sprinkler_system', 'WET-MS','Tyco',          'Wet System',  'TY-MS1',    '2015-08-15', '2026-02-28', 'Main school building'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000005-0000-0000-0000-000000000005', 'kitchen_hood',     'HOOD-MS','Ansul',        'R-102',       'AN-9090',   '2018-06-01', '2026-03-04', 'Cafeteria, line 1');

-- ---------------------------------------------------------------------
-- Work records
-- ---------------------------------------------------------------------
insert into work_records (id, org_id, site_id, customer_id, record_type, status, reference_code,
                          scheduled_for, started_at, completed_at, technician_id, reviewer_id, summary, submitted_at, reviewed_at)
values
  -- approved quarterly inspection at Riverside Main
  ('aaaa1111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001', 'cccccc01-0000-0000-0000-000000000001',
   'inspection', 'approved', 'INSP-2026-0142',
   now() - interval '14 days', now() - interval '14 days', now() - interval '14 days' + interval '5 hours',
   '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
   'Quarterly inspection of wet sprinkler systems and fire pump. Two minor deficiencies noted.',
   now() - interval '13 days', now() - interval '12 days'),

  -- in-review annual test at Northgate DC #1
  ('aaaa1111-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003', 'cccccc02-0000-0000-0000-000000000002',
   'test', 'in_review', 'TEST-2026-0094',
   now() - interval '5 days', now() - interval '5 days', now() - interval '5 days' + interval '7 hours',
   '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
   'Annual fire pump flow test. Churn pressure within spec; 150% flow point marginal.',
   now() - interval '4 days', null),

  -- submitted maintenance at Maplewood
  ('aaaa1111-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000005-0000-0000-0000-000000000005', 'cccccc03-0000-0000-0000-000000000003',
   'maintenance', 'submitted', 'MAINT-2026-0061',
   now() - interval '2 days', now() - interval '2 days', now() - interval '2 days' + interval '3 hours',
   '33333333-3333-3333-3333-333333333333', null,
   'Semi-annual kitchen hood maintenance. Fusible links replaced, nozzles cleaned.',
   now() - interval '2 days', null),

  -- draft service_call at Riverside Clinic
  ('aaaa1111-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000002-0000-0000-0000-000000000002', 'cccccc01-0000-0000-0000-000000000001',
   'service_call', 'draft', 'SVC-2026-0203',
   now() - interval '1 day', now() - interval '1 day', null,
   '44444444-4444-4444-4444-444444444444', null,
   'Trouble signal on FAP-02 — investigating ground fault on loop 2.',
   null, null),

  -- active impairment at Northgate DC #2
  ('aaaa1111-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000004-0000-0000-0000-000000000004', 'cccccc02-0000-0000-0000-000000000002',
   'impairment', 'submitted', 'IMP-2026-0011',
   now() - interval '1 day', now() - interval '1 day', null,
   '33333333-3333-3333-3333-333333333333', null,
   'Planned impairment: ESFR-C taken out of service for valve replacement. AHJ notified.',
   now() - interval '1 day', null),

  -- recent fire watch entry at Northgate DC #2
  ('aaaa1111-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000004-0000-0000-0000-000000000004', 'cccccc02-0000-0000-0000-000000000002',
   'fire_watch', 'approved', 'FW-2026-0011-A',
   now() - interval '1 day', now() - interval '20 hours', now() - interval '4 hours',
   '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
   'Continuous fire watch during ESFR-C impairment. Hourly rounds logged.',
   now() - interval '4 hours', now() - interval '3 hours'),

  -- last week inspection at Riverside Clinic
  ('aaaa1111-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000002-0000-0000-0000-000000000002', 'cccccc01-0000-0000-0000-000000000001',
   'inspection', 'approved', 'INSP-2026-0151',
   now() - interval '6 days', now() - interval '6 days', now() - interval '6 days' + interval '2 hours',
   '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
   'Monthly extinguisher and emergency lighting walk. One extinguisher past 6-yr maintenance.',
   now() - interval '6 days', now() - interval '5 days');

-- update metadata for impairment + fire watch records (uses jsonb on work_records.metadata)
update work_records
  set metadata = jsonb_build_object(
    'impairment_type', 'planned',
    'system_out',      'ESFR-C',
    'ahj_notified',    true,
    'start',           (now() - interval '1 day')::text,
    'expected_end',    (now() + interval '2 days')::text
  )
  where id = 'aaaa1111-0000-0000-0000-000000000005';

update work_records
  set metadata = jsonb_build_object(
    'related_impairment', 'aaaa1111-0000-0000-0000-000000000005',
    'rounds_logged',      16,
    'interval_minutes',   60
  )
  where id = 'aaaa1111-0000-0000-0000-000000000006';

-- ---------------------------------------------------------------------
-- Observations (line items on the approved inspection at Riverside Main)
-- ---------------------------------------------------------------------
insert into work_record_observations (org_id, work_record_id, check_code, description, result, notes) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'NFPA25 5.2.1.1', 'Control valves visual inspection',    'pass', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'NFPA25 5.2.4.1', 'Gauges in good condition',            'pass', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'NFPA25 8.2',     'Fire pump - weekly churn test',       'fail', 'Discharge gauge sticky; needs replacement.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'NFPA25 5.2.3',   'Sprinkler head clearance (min 18 in)', 'fail', 'Storage rack on level 2 stacked above clearance line in two locations.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 'NFPA25 5.2.1',   'Riser room access unobstructed',      'pass', null);

-- ---------------------------------------------------------------------
-- Deficiencies
-- ---------------------------------------------------------------------
insert into deficiencies (id, org_id, site_id, work_record_id, asset_id, severity, status, title, description, code_reference, discovered_on, estimated_cost, assigned_to)
select
  'def00001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001',
  'aaaa1111-0000-0000-0000-000000000001',
  (select id from assets where identifier='FP-01' limit 1),
  'major', 'open',
  'Fire pump discharge gauge sticky',
  'Discharge gauge on FP-01 reads inconsistently during weekly churn; replace gauge and re-test.',
  'NFPA 25 8.3.2.4',
  current_date - 14, 280.00,
  '33333333-3333-3333-3333-333333333333';

insert into deficiencies (id, org_id, site_id, work_record_id, asset_id, severity, status, title, description, code_reference, discovered_on, estimated_cost, assigned_to)
values
  ('def00002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001',
   'aaaa1111-0000-0000-0000-000000000001', null,
   'critical', 'in_progress',
   'Storage obstructing sprinkler clearance',
   'Pallets stored above 18-inch clearance line at two locations on level 2 north wing. Customer notified; awaiting rack relocation.',
   'NFPA 13 8.5.6',
   current_date - 14, 0.00,
   '11111111-1111-1111-1111-111111111111'),

  ('def00003-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000002-0000-0000-0000-000000000002',
   'aaaa1111-0000-0000-0000-000000000007', (select id from assets where identifier='EXT-12'),
   'minor', 'open',
   '6-year extinguisher maintenance overdue',
   'EXT-12 last 6-year maintenance 2018; due for tear-down service.',
   'NFPA 10 7.3.3',
   current_date - 6, 95.00,
   '33333333-3333-3333-3333-333333333333'),

  ('def00004-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003',
   'aaaa1111-0000-0000-0000-000000000002', (select id from assets where identifier='FP-10'),
   'major', 'open',
   'Fire pump 150% flow point marginal',
   'Pump achieved 142% of rated flow at minimum required pressure; spec requires 150%. Recommend impeller inspection.',
   'NFPA 25 8.3.3',
   current_date - 5, 1850.00,
   '11111111-1111-1111-1111-111111111111'),

  ('def00005-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000005-0000-0000-0000-000000000005',
   null, (select id from assets where identifier='HOOD-MS'),
   'advisory', 'resolved',
   'Hood baffle filters needed cleaning',
   'Filters cleaned during semi-annual maintenance.',
   'NFPA 17A 7.2',
   current_date - 2, 0.00,
   '33333333-3333-3333-3333-333333333333'),

  ('def00006-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003',
   null, (select id from assets where identifier='HYD-N1'),
   'minor', 'open',
   'Hydrant cap missing',
   'NW hydrant missing 2-1/2" steamer cap.',
   'NFPA 25 7.3',
   current_date - 30, 65.00,
   '44444444-4444-4444-4444-444444444444');

update deficiencies set resolved_on = current_date - 1 where id = 'def00005-0000-0000-0000-000000000005';

-- ---------------------------------------------------------------------
-- Deficiency updates (timeline)
-- ---------------------------------------------------------------------
insert into deficiency_updates (org_id, deficiency_id, author_id, body, from_status, to_status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'def00002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'Notified Riverside facilities. Customer agreed to relocate racks by end of week.', 'open', 'in_progress'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'def00005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333',
   'Cleaned baffle filters; reinstalled and verified airflow.', 'open', 'resolved');

-- ---------------------------------------------------------------------
-- Audit log highlights
-- ---------------------------------------------------------------------
insert into audit_logs (org_id, actor_id, action, target_table, target_id, payload) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
   'approve', 'work_records', 'aaaa1111-0000-0000-0000-000000000001',
   '{"from_status":"in_review","to_status":"approved"}'::jsonb),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'submit', 'work_records', 'aaaa1111-0000-0000-0000-000000000003',
   '{"from_status":"draft","to_status":"submitted"}'::jsonb),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'create', 'deficiencies', 'def00002-0000-0000-0000-000000000002',
   '{"severity":"critical","title":"Storage obstructing sprinkler clearance"}'::jsonb);

commit;

-- =====================================================================
-- Demo login credentials (after seed runs):
--   admin@sentinel.demo     / DemoPass123!
--   reviewer@sentinel.demo  / DemoPass123!
--   tech1@sentinel.demo     / DemoPass123!
--   tech2@sentinel.demo     / DemoPass123!
-- =====================================================================
