-- =====================================================================
-- Seed 0002 — fill in feature-additions data on top of the base seed.
-- Idempotent: safe to run more than once.
-- Run with:  psql "$SUPABASE_DB_URL" -f supabase/seed/0002_seed_features.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Site contacts
-- ---------------------------------------------------------------------
insert into site_contacts (org_id, site_id, name, role, email, phone, is_primary, notes) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001',
   'Janice Holloway', 'Facilities Director', 'jholloway@riverside.med', '317-555-0142', true,
   'Best reached weekdays 8-4. Has master key.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000001-0000-0000-0000-000000000001',
   'Dwight Park', 'Maintenance Lead', 'dpark@riverside.med', '317-555-0144', false,
   null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000003-0000-0000-0000-000000000003',
   'Marcus Bell', 'Site Manager', 'marcus@northgate-dc.com', '317-555-0188', true,
   'Visits must check in at gatehouse first.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000004-0000-0000-0000-000000000004',
   'Sandra Wu', 'Operations Manager', 'swu@northgate-dc.com', '317-555-0189', true,
   null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5e000005-0000-0000-0000-000000000005',
   'Priya Anand', 'Asst. Superintendent', 'panand@maplewoodsd.org', '317-555-0119', true,
   'After-hours work requires board approval.')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Backfill deficiency priorities, due dates, recommended actions
-- ---------------------------------------------------------------------
update deficiencies set
  priority = 'high',
  due_date = current_date + 14,
  recommended_action = 'Replace discharge gauge. Re-run weekly churn test and document.'
where id = 'def00001-0000-0000-0000-000000000001';

update deficiencies set
  priority = 'urgent',
  due_date = current_date + 5,
  recommended_action = 'Customer to relocate storage below 18-inch clearance line. Verify on next visit.'
where id = 'def00002-0000-0000-0000-000000000002';

update deficiencies set
  priority = 'normal',
  due_date = current_date + 30,
  recommended_action = 'Schedule extinguisher tear-down service.'
where id = 'def00003-0000-0000-0000-000000000003';

update deficiencies set
  priority = 'high',
  due_date = current_date + 21,
  recommended_action = 'Inspect impeller, re-test flow.'
where id = 'def00004-0000-0000-0000-000000000004';

update deficiencies set
  priority = 'low',
  recommended_action = 'Filters cleaned and reinstalled.'
where id = 'def00005-0000-0000-0000-000000000005';

update deficiencies set
  priority = 'normal',
  due_date = current_date + 14,
  recommended_action = 'Order replacement steamer cap and install.'
where id = 'def00006-0000-0000-0000-000000000006';

-- ---------------------------------------------------------------------
-- Add notes + narrative + final_report on existing approved records
-- ---------------------------------------------------------------------
update work_records
set
  notes = E'Pump room is dry. Discharge gauge sticking during churn — confirmed via three consecutive starts. Storage on level 2 north wing is exceeding 18-inch clearance at two pallet racks (rows N-12 and N-14).',
  voice_transcript = E'OK so... weekly churn looks good on suction but discharge needle is hesitating. Did three starts, same behavior. Going to flag the gauge. Heading upstairs to check sprinkler clearance now.',
  final_report = E'DRAFT — generated from technician inputs. Reviewer must verify before finalizing.\n\nA quarterly inspection visit was performed at Riverside Main Hospital (Riverside Medical Center). Work performed by Tomas Tech.\n\nObservations recorded during the visit:\n• Control valves visual inspection — pass\n• Gauges in good condition — pass\n• Fire pump weekly churn test — fail (discharge gauge sticky)\n• Sprinkler head clearance (min 18 in) — fail (two locations on level 2 north wing exceed clearance)\n• Riser room access unobstructed — pass\n\nItems flagged for follow-up:\n• Discharge gauge on FP-01 to be replaced and re-tested.\n• Storage at level 2 north wing rows N-12 and N-14 must be relocated below the 18-inch clearance line; site contact notified.\n\nNFPA citations to be added by the reviewer where applicable.',
  final_report_version = 1
where id = 'aaaa1111-0000-0000-0000-000000000001';

insert into report_versions (org_id, work_record_id, version, kind, content, author_id)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000001', 1, 'finalized',
  final_report, '22222222-2222-2222-2222-222222222222'
from work_records where id = 'aaaa1111-0000-0000-0000-000000000001'
on conflict (work_record_id, version) do nothing;

update work_records
set
  notes = E'Annual fire pump flow test. Churn pressure within spec. 150% flow point reached only 142%. Recommending impeller inspection.',
  final_report = E'DRAFT — generated from technician inputs. Reviewer must verify before finalizing.\n\nAn annual flow test was performed on FP-10 at Northgate DC #1.\n\nObservations:\n• Churn pressure: within spec.\n• 150% rated flow point: pump achieved 142% of rated flow at the minimum required discharge pressure. Spec requires 150%.\n\nFollow-up required:\n• Inspect impeller and run a confirmation test.\n\nNFPA citations to be added by reviewer.',
  final_report_version = 1
where id = 'aaaa1111-0000-0000-0000-000000000002';

update work_records
set
  notes = E'Semi-annual kitchen hood maintenance at Maplewood. Replaced 4 fusible links, cleaned nozzles, verified clean agent charge. Baffle filters cleaned.'
where id = 'aaaa1111-0000-0000-0000-000000000003';

update work_records
set
  notes = E'Investigating ground fault on loop 2 of FAP-02. Initial readings indicate possible damaged conductor in west corridor zone. Pulled affected detector heads for visual check; reinstalled. Will return to trace.'
where id = 'aaaa1111-0000-0000-0000-000000000004';

update work_records
set
  notes = E'Planned impairment of ESFR-C for control valve replacement. AHJ notified at 0830. Fire watch established. Expected duration 3 days.'
where id = 'aaaa1111-0000-0000-0000-000000000005';

update work_records
set
  notes = E'Continuous fire watch during ESFR-C impairment. Hourly rounds logged at 0900, 1000, ... through 2400. No incidents observed.'
where id = 'aaaa1111-0000-0000-0000-000000000006';

update work_records
set
  notes = E'Monthly extinguisher and emergency lighting walk-through. EXT-12 in lobby is past 6-year maintenance.',
  final_report = E'DRAFT — generated from technician inputs. Reviewer must verify before finalizing.\n\nMonthly walk-through of portable extinguishers and emergency egress lighting at Riverside Outpatient Clinic.\n\nObservations:\n• EXT-12 (Amerex B500, lobby) — last 6-year maintenance 2018; tear-down service overdue.\n• Emergency lighting EL-04 (west corridor) — pass.\n\nFollow-up: schedule extinguisher service.',
  final_report_version = 1
where id = 'aaaa1111-0000-0000-0000-000000000007';

insert into report_versions (org_id, work_record_id, version, kind, content, author_id)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-0000-0000-0000-000000000007', 1, 'finalized',
  final_report, '22222222-2222-2222-2222-222222222222'
from work_records where id = 'aaaa1111-0000-0000-0000-000000000007'
on conflict (work_record_id, version) do nothing;

-- ---------------------------------------------------------------------
-- Add a deficiency-follow-up work record + a couple of fresh draft/submitted ones
-- ---------------------------------------------------------------------
insert into work_records (id, org_id, site_id, customer_id, record_type, status, reference_code,
                          scheduled_for, started_at, completed_at, technician_id, summary, notes, submitted_at)
values
  ('aaaa1111-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '5e000001-0000-0000-0000-000000000001', 'cccccc01-0000-0000-0000-000000000001',
   'deficiency_followup', 'submitted', 'DFU-2026-0007',
   now() - interval '3 days', now() - interval '3 days', now() - interval '3 days' + interval '90 minutes',
   '33333333-3333-3333-3333-333333333333',
   'Follow-up: replaced FP-01 discharge gauge; storage clearance still partial.',
   'Replaced discharge gauge on FP-01. Verified weekly churn — gauge now stable. Storage on level 2 north wing partially resolved — N-14 cleared; N-12 still above clearance line. Customer requested another two weeks.',
   now() - interval '3 days' + interval '95 minutes')
on conflict (id) do nothing;

update work_records
  set metadata = jsonb_build_object(
    'addressed', 'Replaced FP-01 discharge gauge. Verified storage at N-14 cleared.',
    'result', 'Partially resolved',
    'remaining', 'Rack N-12 still requires relocation by customer.'
  )
  where id = 'aaaa1111-0000-0000-0000-000000000008';

-- ---------------------------------------------------------------------
-- Sample ai_generations entry (records that prior AI use occurred)
-- ---------------------------------------------------------------------
insert into ai_generations (org_id, target_table, target_id, kind, provider, model, prompt,
                            input_snapshot, output, status, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'work_records',
   'aaaa1111-0000-0000-0000-000000000001', 'report_draft', 'mock', 'mock-baseline-v1',
   '[prompt redacted - see lib/ai/prompts.ts]',
   '{"systemPromptHash":"seed"}'::jsonb,
   'DRAFT — generated from technician inputs. Reviewer must verify before finalizing.\n[seed example output]',
   'ok',
   '22222222-2222-2222-2222-222222222222')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Audit log additions to reflect the above
-- ---------------------------------------------------------------------
insert into audit_logs (org_id, actor_id, action, target_table, target_id, payload) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
   'edit_report', 'work_records', 'aaaa1111-0000-0000-0000-000000000001',
   '{"version":1}'::jsonb),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'submit', 'work_records', 'aaaa1111-0000-0000-0000-000000000008',
   '{"to_status":"submitted"}'::jsonb);

commit;
