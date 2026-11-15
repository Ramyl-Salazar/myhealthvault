-- MyHealthVault 0002: row-level security, table privileges and storage policies.
-- Contract: docs/contracts/database.md.
-- Rule: a signed-in user (role authenticated, anonymous sign-ins included) reaches only
-- their own rows. The anon role (no session) reaches nothing. The service role, used
-- only inside Edge Functions, bypasses row-level security.

-- Row-level security on every table.

alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.documents enable row level security;
alter table public.shares enable row level security;
alter table public.share_access_log enable row level security;
alter table public.reminder_dismissals enable row level security;
alter table public.usage_counters enable row level security;

-- Privileges. Supabase grants everything on new public tables to anon and
-- authenticated by default; take that back and grant only what the app needs.

revoke all on table
  public.profiles, public.records, public.documents, public.shares,
  public.share_access_log, public.reminder_dismissals, public.usage_counters
from anon, authenticated;

-- profiles: read own; update own, except keep and gemini_reads. No insert or delete
-- from the client: seed_demo_data() creates the row and delete_my_data() removes it.
grant select on public.profiles to authenticated;
grant update (display_name, birth_date, sex, blood_type, emergency_contacts, emergency_consent)
  on public.profiles to authenticated;

-- records: full read and write on own rows. Verification is guarded by a trigger (0001).
grant select, insert, update, delete on public.records to authenticated;

-- documents: storage_path and user_id are fixed once the row exists.
grant select, insert, delete on public.documents to authenticated;
grant update (kind, extraction, extraction_status) on public.documents to authenticated;

-- shares: token, records and expiry are fixed once created; label and revoked_at can change.
grant select, insert, delete on public.shares to authenticated;
grant update (label, revoked_at) on public.shares to authenticated;

-- share_access_log: read only, for the share's owner.
grant select on public.share_access_log to authenticated;

-- reminder_dismissals: read, add and remove own.
grant select, insert, update, delete on public.reminder_dismissals to authenticated;

-- usage_counters: no client privileges and no policies.

-- Policies. (select auth.uid()) is evaluated once per statement, not once per row.

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy records_select_own on public.records
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy records_insert_own on public.records
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy records_update_own on public.records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy records_delete_own on public.records
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy documents_select_own on public.documents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy documents_insert_own on public.documents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy documents_update_own on public.documents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy documents_delete_own on public.documents
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy shares_select_own on public.shares
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy shares_insert_own on public.shares
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy shares_update_own on public.shares
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy shares_delete_own on public.shares
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy share_access_log_select_share_owner on public.share_access_log
  for select to authenticated
  using (
    exists (
      select 1 from public.shares s
      where s.id = share_access_log.share_id and s.user_id = (select auth.uid())
    )
  );

create policy reminder_dismissals_select_own on public.reminder_dismissals
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy reminder_dismissals_insert_own on public.reminder_dismissals
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy reminder_dismissals_update_own on public.reminder_dismissals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy reminder_dismissals_delete_own on public.reminder_dismissals
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Storage: objects in the documents bucket live under <user_id>/. A signed-in user
-- reaches only objects whose first folder is their own id.

create policy documents_bucket_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy documents_bucket_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy documents_bucket_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy documents_bucket_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
