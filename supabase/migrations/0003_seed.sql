-- MyHealthVault 0003: seed_demo_data() and delete_my_data().
-- Contract: docs/contracts/database.md.
-- Both act only on auth.uid(), refuse a caller with no session, and are executable by
-- the authenticated role only. All data is fictional: patient, providers and verifiers.

create or replace function public.seed_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date := current_date;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Remove the caller's existing data. The access log goes with its shares.
  -- Stored files are not touched here; see the contract.
  delete from public.records where user_id = uid;
  delete from public.documents where user_id = uid;
  delete from public.shares where user_id = uid;
  delete from public.reminder_dismissals where user_id = uid;

  -- Create or reset the profile. keep and gemini_reads are left as they are.
  insert into public.profiles (
    id, display_name, birth_date, sex, blood_type, emergency_contacts, emergency_consent
  ) values (
    uid,
    'Lourdes Villareal',
    date '1968-03-12',
    'female',
    'O+',
    jsonb_build_array(
      jsonb_build_object('name', 'Ramon Villareal', 'relation', 'Husband', 'phone', '0917 555 0142'),
      jsonb_build_object('name', 'Carla Villareal-Dizon', 'relation', 'Daughter', 'phone', '0918 555 0187')
    ),
    false
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    birth_date = excluded.birth_date,
    sex = excluded.sex,
    blood_type = excluded.blood_type,
    emergency_contacts = excluded.emergency_contacts,
    emergency_consent = excluded.emergency_consent;

  insert into public.records (
    user_id, type, title, occurred_on, details, provider_name, notes, status,
    trust_level, verified_by, verified_license, verified_at
  ) values
  -- Diagnoses
  (
    uid, 'diagnosis', 'Type 2 diabetes', (d - interval '6 years 2 months')::date,
    jsonb_build_object('kind', 'diagnosis'),
    'San Rafael Medical Center', null, 'active',
    'clinician_verified', 'Dr. Isabel Cruz-Manalo', '0098765', now() - interval '40 days'
  ),
  (
    uid, 'diagnosis', 'Hypertension', (d - interval '4 years 5 months')::date,
    jsonb_build_object('kind', 'diagnosis'),
    'Barangay Malaya Health Center', null, 'active',
    'document_supported', null, null, null
  ),
  (
    uid, 'diagnosis', 'Acute bronchitis', (d - interval '2 years 1 month')::date,
    jsonb_build_object('kind', 'diagnosis'),
    'Barangay Malaya Health Center', null, 'resolved',
    'patient_entered', null, null, null
  ),
  -- Allergy
  (
    uid, 'allergy', 'Penicillin', (d - interval '9 years')::date,
    jsonb_build_object('kind', 'allergy', 'reaction', 'Rash', 'severity', 'moderate'),
    'San Rafael Medical Center', null, 'active',
    'clinician_verified', 'Dr. Isabel Cruz-Manalo', '0098765', now() - interval '40 days'
  ),
  -- Medications: three active, one finished
  (
    uid, 'medication', 'Metformin', (d - interval '6 years 2 months')::date,
    jsonb_build_object(
      'kind', 'medication', 'genericName', 'Metformin', 'dose', '500 mg', 'frequency', 'twice daily',
      'startOn', to_char((d - interval '6 years 2 months')::date, 'YYYY-MM-DD'), 'endOn', null
    ),
    'San Rafael Medical Center', null, 'active',
    'document_supported', null, null, null
  ),
  (
    uid, 'medication', 'Glucophage', (d - interval '3 months')::date,
    jsonb_build_object(
      'kind', 'medication', 'genericName', null, 'dose', '500 mg', 'frequency', 'twice daily',
      'startOn', to_char((d - interval '3 months')::date, 'YYYY-MM-DD'), 'endOn', null
    ),
    'Barangay Malaya Health Center', null, 'active',
    'patient_entered', null, null, null
  ),
  (
    uid, 'medication', 'Losartan', (d - interval '25 days')::date,
    jsonb_build_object(
      'kind', 'medication', 'genericName', 'Losartan', 'dose', '50 mg', 'frequency', 'once daily',
      'startOn', to_char((d - interval '25 days')::date, 'YYYY-MM-DD'), 'endOn', to_char(d + 5, 'YYYY-MM-DD')
    ),
    'San Rafael Medical Center', null, 'active',
    'clinician_verified', 'Dr. Paolo Santiago', '0112233', now() - interval '20 days'
  ),
  (
    uid, 'medication', 'Azithromycin', (d - interval '2 years 1 month')::date,
    jsonb_build_object(
      'kind', 'medication', 'genericName', 'Azithromycin', 'dose', '500 mg', 'frequency', 'once daily',
      'startOn', to_char((d - interval '2 years 1 month')::date, 'YYYY-MM-DD'),
      'endOn', to_char((d - interval '2 years 1 month')::date + 3, 'YYYY-MM-DD')
    ),
    'Barangay Malaya Health Center', null, 'resolved',
    'patient_entered', null, null, null
  ),
  -- Lab results
  (
    uid, 'lab_result', 'HbA1c', (d - interval '35 days')::date,
    jsonb_build_object(
      'kind', 'lab_result',
      'results', jsonb_build_array(
        jsonb_build_object('name', 'HbA1c', 'value', '7.2', 'unit', '%', 'referenceRange', '4.0-5.6')
      )
    ),
    'Lakandula Diagnostics', null, 'active',
    'document_supported', null, null, null
  ),
  (
    uid, 'lab_result', 'Lipid profile', (d - interval '7 months')::date,
    jsonb_build_object(
      'kind', 'lab_result',
      'results', jsonb_build_array(
        jsonb_build_object('name', 'Total cholesterol', 'value', '5.4', 'unit', 'mmol/L', 'referenceRange', '<5.2'),
        jsonb_build_object('name', 'LDL cholesterol', 'value', '3.3', 'unit', 'mmol/L', 'referenceRange', '<3.4'),
        jsonb_build_object('name', 'HDL cholesterol', 'value', '1.2', 'unit', 'mmol/L', 'referenceRange', '>1.0'),
        jsonb_build_object('name', 'Triglycerides', 'value', '1.9', 'unit', 'mmol/L', 'referenceRange', '<1.7')
      )
    ),
    'Lakandula Diagnostics', null, 'active',
    'patient_entered', null, null, null
  ),
  -- Immunizations
  (
    uid, 'immunization', 'Influenza vaccine', (d - interval '2 months')::date,
    jsonb_build_object('kind', 'immunization', 'doseNumber', null),
    'Barangay Malaya Health Center', null, 'active',
    'document_supported', null, null, null
  ),
  (
    uid, 'immunization', 'Pneumococcal vaccine', (d - interval '1 year 6 months')::date,
    jsonb_build_object('kind', 'immunization', 'doseNumber', '1'),
    'San Rafael Medical Center', null, 'active',
    'patient_entered', null, null, null
  ),
  -- Procedure
  (
    uid, 'procedure', 'Cataract surgery, right eye', (d - interval '1 year 3 months')::date,
    jsonb_build_object('kind', 'procedure'),
    'San Rafael Medical Center', null, 'resolved',
    'clinician_verified', 'Dr. Paolo Santiago', '0112233', now() - interval '20 days'
  ),
  -- Visits
  (
    uid, 'visit', 'Diabetes and blood pressure check', (d - interval '25 days')::date,
    jsonb_build_object(
      'kind', 'visit', 'reason', 'Diabetes and blood pressure check', 'followUpOn', to_char(d + 10, 'YYYY-MM-DD')
    ),
    'San Rafael Medical Center', null, 'active',
    'patient_entered', null, null, null
  ),
  (
    uid, 'visit', 'Eye check after cataract surgery', (d - interval '1 year 2 months')::date,
    jsonb_build_object('kind', 'visit', 'reason', 'Eye check after cataract surgery', 'followUpOn', null),
    'San Rafael Medical Center', null, 'resolved',
    'document_supported', null, null, null
  ),
  (
    uid, 'visit', 'Cough and fever', (d - interval '2 years 1 month')::date,
    jsonb_build_object('kind', 'visit', 'reason', 'Cough and fever', 'followUpOn', null),
    'Barangay Malaya Health Center', null, 'resolved',
    'patient_entered', null, null, null
  );
end;
$$;

create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  delete from public.records where user_id = uid;
  delete from public.documents where user_id = uid;
  delete from public.shares where user_id = uid;
  delete from public.reminder_dismissals where user_id = uid;
  delete from public.profiles where id = uid;
end;
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default.
revoke all on function public.seed_demo_data() from public, anon, authenticated;
revoke all on function public.delete_my_data() from public, anon, authenticated;
grant execute on function public.seed_demo_data() to authenticated;
grant execute on function public.delete_my_data() to authenticated;
