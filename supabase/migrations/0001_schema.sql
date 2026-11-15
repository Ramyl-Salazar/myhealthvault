-- MyHealthVault 0001: tables, types, constraints, indexes, triggers and the documents bucket.
-- Contract: docs/contracts/database.md. Enum values match src/domain/types.ts.
-- Access rules are in 0002_rls.sql; nothing here is reachable by a client until that runs.

-- Types

create type public.record_type as enum (
  'diagnosis', 'allergy', 'medication', 'lab_result', 'immunization', 'procedure', 'visit'
);

create type public.trust_level as enum ('patient_entered', 'document_supported', 'clinician_verified');

create type public.record_status as enum ('active', 'resolved');

-- profiles: one row per signed-in user, created by seed_demo_data().

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 200),
  birth_date date,
  sex text check (char_length(sex) <= 40),
  blood_type text check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  emergency_contacts jsonb not null default '[]'::jsonb check (jsonb_typeof(emergency_contacts) = 'array'),
  emergency_consent boolean not null default false,
  keep boolean not null default false,
  gemini_reads integer not null default 0 check (gemini_reads >= 0),
  created_at timestamptz not null default now()
);

-- documents: one scanned image each. The object lives in the documents bucket at
-- <user_id>/<document_id>.jpg (png and webp extensions are also accepted).

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null,
  kind text not null default '' check (char_length(kind) <= 100),
  extraction jsonb,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'read', 'needs_help', 'failed')),
  created_at timestamptz not null default now(),
  -- The path must be inside the owner's own folder and named after the row, so a row
  -- can never point a server-side reader at someone else's file.
  constraint documents_storage_path_is_own check (
    storage_path ~ ('^' || user_id::text || '/' || id::text || '\.(jpg|jpeg|png|webp)$')
  ),
  constraint documents_id_user_key unique (id, user_id)
);

create index documents_user_id_idx on public.documents (user_id);

-- records

create table public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.record_type not null,
  title text not null check (char_length(btrim(title)) > 0 and char_length(title) <= 500),
  occurred_on date,
  details jsonb not null,
  provider_name text check (char_length(provider_name) <= 300),
  notes text check (char_length(notes) <= 5000),
  status public.record_status not null default 'active',
  trust_level public.trust_level not null default 'patient_entered',
  document_id uuid,
  verified_by text check (char_length(verified_by) <= 200),
  verified_license text check (char_length(verified_license) <= 100),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint records_details_kind_matches_type check (
    jsonb_typeof(details) = 'object' and details ->> 'kind' = type::text
  ),
  -- Verifier fields are all set exactly when the record is clinician verified.
  constraint records_verifier_matches_trust check (
    case when trust_level = 'clinician_verified'
      then verified_by is not null and verified_license is not null and verified_at is not null
      else verified_by is null and verified_license is null and verified_at is null
    end
  ),
  -- A record can only link to a document owned by the same user.
  constraint records_document_same_owner foreign key (document_id, user_id)
    references public.documents (id, user_id) on delete set null (document_id)
);

create index records_user_id_idx on public.records (user_id);
create index records_document_id_idx on public.records (document_id);

-- shares: the raw token is never stored, only its SHA-256 hex digest.

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 200),
  record_ids uuid[] not null check (cardinality(record_ids) > 0 and array_position(record_ids, null) is null),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shares_expires_after_created check (expires_at > created_at)
);

create index shares_user_id_idx on public.shares (user_id);

-- share_access_log: written only by the share Edge Functions (service role).

create table public.share_access_log (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares (id) on delete cascade,
  action text not null check (action in ('viewed', 'verified')),
  record_id uuid references public.records (id) on delete set null,
  device text not null default '' check (char_length(device) <= 200),
  created_at timestamptz not null default now()
);

create index share_access_log_share_id_idx on public.share_access_log (share_id);
create index share_access_log_record_id_idx on public.share_access_log (record_id);

-- reminder_dismissals: reminder keys come from computeReminders in src/domain/reminders.ts.

create table public.reminder_dismissals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reminder_key text not null check (char_length(reminder_key) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, reminder_key)
);

-- usage_counters: app-wide Gemini reads per day (UTC), service role only.

create table public.usage_counters (
  day date primary key,
  gemini_reads integer not null default 0 check (gemini_reads >= 0)
);

-- Triggers

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger records_set_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

-- A signed-in client may not create or alter a clinician verification. Only the
-- share-verify Edge Function (service role) and seed_demo_data() (definer) can.
-- Clearing a verification (trust dropping back) stays allowed.
create function public.records_guard_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.trust_level <> 'clinician_verified' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if old.trust_level <> 'clinician_verified'
    or new.verified_by is distinct from old.verified_by
    or new.verified_license is distinct from old.verified_license
    or new.verified_at is distinct from old.verified_at then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger records_guard_verification
  before insert or update on public.records
  for each row execute function public.records_guard_verification();

-- A share may only list the owner's own records, and a revoked share stays revoked.
-- Runs as the caller, so under row-level security a client only sees its own records.
create function public.shares_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  check_records boolean := true;
begin
  if tg_op = 'UPDATE' then
    if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    check_records := new.record_ids is distinct from old.record_ids
      or new.user_id is distinct from old.user_id;
  end if;
  if check_records and (
    select count(distinct r.id)
    from public.records r
    where r.id = any (new.record_ids) and r.user_id = new.user_id
  ) <> (
    select count(distinct u.id) from unnest(new.record_ids) as u (id)
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger shares_guard
  before insert or update on public.shares
  for each row execute function public.shares_guard();

-- Storage bucket for scanned images: private, 10 MB, images only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
