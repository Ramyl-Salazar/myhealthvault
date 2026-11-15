# Database contract

Source of truth: `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_seed.sql`. Types on the client: `src/domain/types.ts`. Postgres 17 on Supabase project `waqlvbmsbgtqmcpeckzv`.

## Apply order

1. `0001_schema.sql`: types, tables, constraints, indexes, triggers, the `documents` bucket.
2. `0002_rls.sql`: row-level security, table privileges, storage policies.
3. `0003_seed.sql`: `seed_demo_data()` and `delete_my_data()`.

Anonymous sign-ins must be enabled in Supabase Auth. Anonymous users get the `authenticated` role, which is what every policy below targets.

## Enums

| Postgres type | Values | TypeScript |
|---|---|---|
| `record_type` | `diagnosis`, `allergy`, `medication`, `lab_result`, `immunization`, `procedure`, `visit` | `RecordType` |
| `trust_level` | `patient_entered`, `document_supported`, `clinician_verified` | `TrustLevel` |
| `record_status` | `active`, `resolved` | `RecordStatus` |

## Tables

Every `user_id` (and `profiles.id`) references `auth.users(id) on delete cascade`, so deleting an auth user removes all of that user's rows. `user_id` defaults to `auth.uid()` where it exists, so a client may leave it out.

### profiles

One row per user, created by `seed_demo_data()`.

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid, primary key | The user's `auth.uid()`. |
| `display_name` | text, not null, default `''` | Patient name. At most 200 characters. |
| `birth_date` | date, null | |
| `sex` | text, null | Free text, at most 40 characters. Seed uses `female`. |
| `blood_type` | text, null | One of `A+ A- B+ B- AB+ AB- O+ O-`, or null. |
| `emergency_contacts` | jsonb, not null, default `[]` | Array of `{ "name", "relation", "phone" }`, all strings. |
| `emergency_consent` | boolean, default false | Emergency card consent. |
| `keep` | boolean, default false | Exempts the account from the 7-day cleanup. Set by hand in Supabase only. |
| `gemini_reads` | integer, default 0 | Google AI reads used by this account. Written by the `read-document` Edge Function only. |
| `created_at` | timestamptz | |

### records

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid, primary key, default `gen_random_uuid()` | A client may supply its own id, so a retried save cannot insert twice. |
| `user_id` | uuid, not null | Owner. |
| `type` | `record_type`, not null | |
| `title` | text, not null | Not blank, at most 500 characters. For medications, the drug name only (`Metformin`), dose and frequency go in `details`. |
| `occurred_on` | date, null | |
| `details` | jsonb, not null | See below. `details.kind` must equal `type` (check constraint). |
| `provider_name` | text, null | |
| `notes` | text, null | At most 5000 characters. |
| `status` | `record_status`, default `active` | |
| `trust_level` | `trust_level`, default `patient_entered` | |
| `document_id` | uuid, null | The scanned document this came from. Must belong to the same user (composite foreign key on `(document_id, user_id)`). Set to null if the document row is deleted. |
| `verified_by` | text, null | Clinician name as typed. |
| `verified_license` | text, null | Licence number as typed. Not checked. |
| `verified_at` | timestamptz, null | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Set by trigger on every update. |

Rules enforced by the database:

- The three `verified_*` fields are all set when `trust_level = 'clinician_verified'`, and all null otherwise. When an edit drops trust, send `trust_level` and the three nulls together.
- A signed-in client cannot insert a `clinician_verified` record, cannot change a record to `clinician_verified`, and cannot change the verifier fields of a verified record. It can edit other fields of a verified record and can clear the verification. Only the `share-verify` Edge Function (service role) and `seed_demo_data()` set verifications. The error is `42501 not allowed`.

### details shapes

Keys are camelCase, exactly as `RecordDetails` in `src/domain/types.ts`. Dates inside `details` are `YYYY-MM-DD` strings. Unknown values are `null`, never missing.

| `type` | `details` |
|---|---|
| `diagnosis` | `{ "kind": "diagnosis" }` |
| `procedure` | `{ "kind": "procedure" }` |
| `allergy` | `{ "kind": "allergy", "reaction": string\|null, "severity": "mild"\|"moderate"\|"severe"\|null }` |
| `medication` | `{ "kind": "medication", "genericName": string\|null, "dose": string\|null, "frequency": string\|null, "startOn": date\|null, "endOn": date\|null }` |
| `lab_result` | `{ "kind": "lab_result", "results": [{ "name": string, "value": string, "unit": string\|null, "referenceRange": string\|null }] }` |
| `immunization` | `{ "kind": "immunization", "doseNumber": string\|null }` |
| `visit` | `{ "kind": "visit", "reason": string\|null, "followUpOn": date\|null }` |

The database checks only that `details` is an object whose `kind` equals `type`. The rest of the shape is the client's job (`src/data/mappers.ts`).

### documents

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid, primary key, default `gen_random_uuid()` | Generate it on the client before upload, because the path contains it. |
| `user_id` | uuid, not null | Owner. |
| `storage_path` | text, not null | Must be exactly `<user_id>/<id>.jpg` (also accepted: `.jpeg`, `.png`, `.webp`). Check constraint. |
| `kind` | text, default `''` | Free text, for example `prescription`, `lab-report`, `discharge`. |
| `extraction` | jsonb, null | Extraction result, for example the candidate records. |
| `extraction_status` | text, default `pending` | One of `pending`, `read`, `needs_help`, `failed`. |
| `created_at` | timestamptz | |

`storage_path` and `user_id` cannot be changed after insert.

### shares

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid, primary key | |
| `user_id` | uuid, not null | Owner. |
| `label` | text, default `''` | |
| `record_ids` | uuid[], not null | At least one id, no nulls. Every id must be a record owned by `user_id` (trigger). |
| `token_hash` | text, not null, unique | SHA-256 of the raw token, 64 lowercase hex characters. The raw token is never stored. |
| `expires_at` | timestamptz, not null | Must be after `created_at`. |
| `revoked_at` | timestamptz, null | Set once to revoke. Cannot be cleared or changed after that (trigger). |
| `created_at` | timestamptz | |

A client can change only `label` and `revoked_at` after insert.

Note for the share Edge Functions: record ids are checked against the owner only when the share is written. A record deleted later leaves a stale id. Always load shared records with `id = any(record_ids) and user_id = share.user_id`.

### share_access_log

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid, primary key | |
| `share_id` | uuid, not null | References `shares(id) on delete cascade`. |
| `action` | text, not null | `viewed` or `verified`. |
| `record_id` | uuid, null | The verified record. References `records(id) on delete set null`. |
| `device` | text, default `''` | Short device summary, at most 200 characters. |
| `created_at` | timestamptz | |

### reminder_dismissals

| Column | Type | Meaning |
|---|---|---|
| `user_id` | uuid | Owner. |
| `reminder_key` | text | `Reminder.key` from `computeReminders`, for example `dup:metformin`. |
| `created_at` | timestamptz | |

Primary key `(user_id, reminder_key)`. Dismissing twice: use `upsert` or ignore the duplicate-key error.

### usage_counters

| Column | Type | Meaning |
|---|---|---|
| `day` | date, primary key | UTC day. |
| `gemini_reads` | integer, default 0 | Google AI reads across the whole app that day. |

Service role only.

## Storage

- Bucket `documents`: private, 10 MB per file, MIME types `image/jpeg`, `image/png`, `image/webp`.
- Object path: `<user_id>/<document_id>.jpg`. The first folder must be the signed-in user's id.
- A signed-in user can read, upload, update and delete only objects under their own folder. Read with signed URLs.
- Database functions do not remove stored files. Remove them through the Storage API (list the `<user_id>/` folder, then remove), before calling `delete_my_data()`.

## Who can do what

`authenticated` is any signed-in user, anonymous or not. `anon` is a request with no session. The service role is used only inside Edge Functions and bypasses row-level security.

| Table | authenticated | anon |
|---|---|---|
| `profiles` | Read own row. Update own `display_name`, `birth_date`, `sex`, `blood_type`, `emergency_contacts`, `emergency_consent`. No insert, no delete, cannot write `keep` or `gemini_reads`. | Nothing |
| `records` | Read, insert, update, delete own rows. Cannot set `user_id` to anyone else. Verification guarded as above. | Nothing |
| `documents` | Read, insert, delete own rows. Update own `kind`, `extraction`, `extraction_status`. | Nothing |
| `shares` | Read, insert, delete own rows. Update own `label`, `revoked_at`. | Nothing |
| `share_access_log` | Read rows of own shares. No writes. | Nothing |
| `reminder_dismissals` | Read, insert, update, delete own rows. | Nothing |
| `usage_counters` | Nothing | Nothing |

Row-level security is on for every table. Rows of other users are invisible: a select returns none, an update or delete affects none, and an insert or update that would give a row to someone else fails with a row-level security error.

Use `update` on `profiles`, not `upsert`, because the client has no insert privilege there.

## Functions

Both are `security definer` with `search_path = ''`, act only on `auth.uid()`, raise `42501 not signed in` when there is no user, and are executable by `authenticated` only. Call with `supabase.rpc('<name>')`; neither takes arguments or returns a value.

### seed_demo_data()

Deletes the caller's records, documents (rows only), shares (with their access log) and reminder dismissals, then creates or resets the profile and inserts the demo patient. `keep` and `gemini_reads` are left as they are; `emergency_consent` is reset to false. Dates are relative to `current_date` (UTC). Calling it twice leaves the same data.

Patient: Lourdes Villareal, born 1968-03-12, female, blood type O+. Emergency contacts: Ramon Villareal (Husband, 0917 555 0142), Carla Villareal-Dizon (Daughter, 0918 555 0187).

Records (16):

| Type | Title | Status | Trust | Notes |
|---|---|---|---|---|
| diagnosis | Type 2 diabetes | active | clinician_verified | San Rafael Medical Center |
| diagnosis | Hypertension | active | document_supported | Barangay Malaya Health Center |
| diagnosis | Acute bronchitis | resolved | patient_entered | about 2 years ago |
| allergy | Penicillin | active | clinician_verified | reaction Rash, severity moderate |
| medication | Metformin | active | document_supported | genericName Metformin, 500 mg, twice daily |
| medication | Glucophage | active | patient_entered | genericName null, 500 mg, twice daily (possible duplicate of Metformin) |
| medication | Losartan | active | clinician_verified | genericName Losartan, 50 mg, once daily, endOn today + 5 |
| medication | Azithromycin | resolved | patient_entered | finished course |
| lab_result | HbA1c | active | document_supported | 7.2 %, range 4.0-5.6, Lakandula Diagnostics |
| lab_result | Lipid profile | active | patient_entered | four results, Lakandula Diagnostics |
| immunization | Influenza vaccine | active | document_supported | |
| immunization | Pneumococcal vaccine | active | patient_entered | doseNumber 1 |
| procedure | Cataract surgery, right eye | resolved | clinician_verified | |
| visit | Diabetes and blood pressure check | active | patient_entered | followUpOn today + 10 |
| visit | Eye check after cataract surgery | resolved | document_supported | |
| visit | Cough and fever | resolved | patient_entered | |

Active totals: two conditions, one allergy, three medications. Seeded `document_supported` records have no `document_id`; there are no seeded images. Fictional verifiers: Dr. Isabel Cruz-Manalo (licence 0098765) and Dr. Paolo Santiago (licence 0112233).

### delete_my_data()

Deletes every row the caller owns: records, documents, shares (with their access log), reminder dismissals and the profile. It does not delete stored files or the auth user.
