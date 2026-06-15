-- =====================================================================
-- Seed 0003 — Jurisdictions (Ohio, Kentucky, Indiana) + city AHJs +
-- sample Ohio amendments. Backfills existing demo sites with the
-- right jurisdiction.
--
-- Run with:  psql "$SUPABASE_DB_URL" -f supabase/seed/0003_seed_jurisdictions.sql
-- Or paste into Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- State-level jurisdictions
-- ---------------------------------------------------------------------
insert into jurisdictions (id, name, jurisdiction_type, state, nfpa_editions, adopted_code, notes) values
  ('70000000-0000-0000-0000-0000000000ff',
   'Ohio (State)', 'state', 'OH',
   '{"NFPA 1":"2018","NFPA 10":"2018","NFPA 13":"2019","NFPA 17A":"2017","NFPA 25":"2020","NFPA 72":"2019","NFPA 80":"2019"}'::jsonb,
   'Ohio Fire Code 2017 (OAC 1301:7-7), with 2021 revisions',
   'Enforced by the Ohio State Fire Marshal; local AHJs may amend further.'),

  ('70000000-0000-0000-0000-0000000000ee',
   'Kentucky (State)', 'state', 'KY',
   '{"NFPA 1":"2018","NFPA 10":"2018","NFPA 13":"2019","NFPA 17A":"2017","NFPA 25":"2020","NFPA 72":"2019"}'::jsonb,
   'Kentucky Standards of Safety (815 KAR 10:060)',
   'Enforced by the KY Office of State Fire Marshal.'),

  ('70000000-0000-0000-0000-0000000000dd',
   'Indiana (State)', 'state', 'IN',
   '{"NFPA 1":"2018","NFPA 10":"2018","NFPA 13":"2016","NFPA 17A":"2017","NFPA 25":"2017","NFPA 72":"2016"}'::jsonb,
   'Indiana Fire Code 2014 (675 IAC 22-2.5); IBC 2014 base',
   'Indiana is on older editions of multiple standards — verify before citing.')

on conflict (id) do update set
  nfpa_editions = excluded.nfpa_editions,
  adopted_code = excluded.adopted_code,
  notes = excluded.notes;

-- ---------------------------------------------------------------------
-- Sample city-level AHJs (sub-jurisdictions)
-- ---------------------------------------------------------------------
insert into jurisdictions (id, name, jurisdiction_type, state, city, parent_id, nfpa_editions, adopted_code, notes) values
  ('70000000-0000-0000-0001-000000000001',
   'Cincinnati Fire Department', 'city', 'OH', 'Cincinnati',
   '70000000-0000-0000-0000-0000000000ff',
   '{"NFPA 25":"2020","NFPA 72":"2019"}'::jsonb,
   'Cincinnati Municipal Code Title XV + Ohio Fire Code',
   'CFD enforces OFC with local amendments — see Title XV §1501.'),

  ('70000000-0000-0000-0001-000000000002',
   'Columbus Fire Division', 'city', 'OH', 'Columbus',
   '70000000-0000-0000-0000-0000000000ff',
   '{"NFPA 25":"2020"}'::jsonb,
   'Columbus City Code 2511 + Ohio Fire Code',
   null),

  ('70000000-0000-0000-0001-000000000003',
   'Louisville Fire & Rescue', 'city', 'KY', 'Louisville',
   '70000000-0000-0000-0000-0000000000ee',
   '{"NFPA 25":"2020"}'::jsonb,
   'Louisville Metro Code of Ordinances §94 + KY Standards of Safety',
   null),

  ('70000000-0000-0000-0001-000000000004',
   'Lexington Fire Department', 'city', 'KY', 'Lexington',
   '70000000-0000-0000-0000-0000000000ee',
   '{"NFPA 25":"2020"}'::jsonb,
   'Lexington-Fayette Urban County Code §6 + KY Standards of Safety',
   null),

  ('70000000-0000-0000-0001-000000000005',
   'Indianapolis Fire Department', 'city', 'IN', 'Indianapolis',
   '70000000-0000-0000-0000-0000000000dd',
   '{"NFPA 25":"2017"}'::jsonb,
   'Indianapolis Code of Ordinances §521 + Indiana Fire Code',
   'IFD plan-review office requires Form 49.'),

  ('70000000-0000-0000-0001-000000000006',
   'Carmel Fire Department', 'city', 'IN', 'Carmel',
   '70000000-0000-0000-0000-0000000000dd',
   '{"NFPA 25":"2017"}'::jsonb,
   'City of Carmel Code Ch 6 + Indiana Fire Code',
   null),

  ('70000000-0000-0000-0001-000000000007',
   'Whitestown Fire Department', 'city', 'IN', 'Whitestown',
   '70000000-0000-0000-0000-0000000000dd',
   '{"NFPA 25":"2017"}'::jsonb,
   'Town of Whitestown ordinances + Indiana Fire Code',
   null)
on conflict (id) do update set
  parent_id = excluded.parent_id,
  nfpa_editions = excluded.nfpa_editions,
  adopted_code = excluded.adopted_code,
  notes = excluded.notes;

-- ---------------------------------------------------------------------
-- Sample code amendments — Ohio (a few illustrative entries)
-- ---------------------------------------------------------------------
-- These are illustrative; real production usage requires verified data from
-- the State Fire Marshal's office. Edit with confirmed sources.
insert into code_amendments (jurisdiction_id, source_ref, local_ref, frequency_override, description, notes) values
  ('70000000-0000-0000-0000-0000000000ff',
   'NFPA 25 5.2', 'OFC 901.6.1',
   null,
   'Inspection of water-based fire protection systems — Ohio cites OFC 901.6.1.',
   'Verify exact section number against current OFC edition.'),

  ('70000000-0000-0000-0000-0000000000ff',
   'NFPA 25 8.3.2.4', 'OFC 904.3.4.2',
   null,
   'Fire pump weekly churn test reporting.',
   null),

  ('70000000-0000-0000-0000-0000000000ff',
   'NFPA 25 13.2.5', 'OFC 904.4',
   'annual',
   'Backflow preventer forward flow test — Ohio AHJs frequently require annual rather than per-NFPA cycle.',
   null),

  ('70000000-0000-0000-0000-0000000000ff',
   'NFPA 72 14.4.5', 'OFC 907.8',
   null,
   'Fire alarm system testing and inspection records retention.',
   null),

  ('70000000-0000-0000-0000-0000000000ff',
   'NFPA 17A 7.2', 'OFC 904.12',
   'semi_annual',
   'Pre-engineered kitchen hood suppression — semi-annual maintenance.',
   null),

  -- Indiana sample
  ('70000000-0000-0000-0000-0000000000dd',
   'NFPA 25 8.3', '675 IAC 22-2.5 §904.3',
   null,
   'Fire pump testing referenced via Indiana Fire Code rather than NFPA directly.',
   'Indiana adopts older NFPA editions — confirm with AHJ on edition year.'),

  -- Kentucky sample
  ('70000000-0000-0000-0000-0000000000ee',
   'NFPA 25 5.2', 'KSS §6.10.2',
   null,
   'Water-based system inspection requirements per Kentucky Standards of Safety.',
   null);

-- ---------------------------------------------------------------------
-- Backfill existing demo sites
-- ---------------------------------------------------------------------
-- Our seed places everything in the Indianapolis area.
update sites
  set jurisdiction_id = '70000000-0000-0000-0001-000000000005'  -- Indianapolis FD
  where id in (
    '5e000001-0000-0000-0000-000000000001',  -- Riverside Main
    '5e000002-0000-0000-0000-000000000002'   -- Riverside Clinic
  );

update sites
  set jurisdiction_id = '70000000-0000-0000-0001-000000000007'  -- Whitestown FD
  where id in (
    '5e000003-0000-0000-0000-000000000003',  -- Northgate DC #1
    '5e000004-0000-0000-0000-000000000004'   -- Northgate DC #2
  );

update sites
  set jurisdiction_id = '70000000-0000-0000-0001-000000000006'  -- Carmel FD
  where id = '5e000005-0000-0000-0000-000000000005';            -- Maplewood HS

commit;
