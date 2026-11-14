# MyHealthVault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MyHealthVault demo: a patient-controlled health history app, live on a public link, installable on iPhone, with an Android APK.

**Architecture:** One Vite + React + TypeScript app. Pure logic lives in `src/domain/` and is tested without a browser; `src/data/` is the only code that talks to Supabase; screens compose the two. Supabase holds auth, Postgres (row-level security), Storage and three Edge Functions. Capacitor wraps the same build for Android.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS v4, React Router, TanStack Query (with persisted cache), `@supabase/supabase-js`, `vite-plugin-pwa`, `tesseract.js`, `qrcode.react`, `lucide-react` (the one icon set), Capacitor (`@capacitor/android`, `@capacitor/local-notifications`), Vitest + Testing Library, Playwright. Use current stable versions.

**Spec:** `docs/superpowers/specs/2026-11-14-myhealthvault-design.md`. Read it before any task.

## Global Constraints

- Zero running cost. No paid API, no billing-enabled key.
- Demo data only. Fictional patient, fictional provider names, no real hospital names.
- The app never states or implies medical advice. No language model writes the health summary.
- Nothing is saved from a scan without the user confirming it. Unreadable fields stay empty, never guessed.
- `docs/rules/no-slop.md` binds every task. `npm run check:slop` must pass before a task is handed in.
- All user-facing text lives in `src/copy/`. No string literal a user can read appears in a component.
- Sentence case, no exclamation marks, no em dashes in any user-facing text.
- One date format everywhere: `14 Nov 2026`, through `formatDate`.
- Touch targets at least 44px. Screens checked at 360, 768 and 1440 wide.
- Every screen has designed empty, loading and error states.
- Colours, type, spacing and radius come only from `src/styles/tokens.css`.
- Builders may not change `src/domain/types.ts`, the migrations, or an Edge Function's request and response shape. They report back to the architect.
- Builders write migrations and functions. Only the architect applies them to Supabase, deploys, or changes project settings.
- Supabase project ref: `waqlvbmsbgtqmcpeckzv`. Vercel project: `myhealthvault`. Repository: `Ramyl-Salazar/myhealthvault`.

## How the team runs this plan

| Agent | Model | Used for |
|---|---|---|
| Architect (main session) | Fable | Tasks 1 and 3, every brief, applying migrations, deploys, final acceptance |
| `mhv-senior-builder` | Opus | Tasks 4, 12, 14, 15, 20 |
| `mhv-builder` | Sonnet | Tasks 2, 5, 6, 7, 8, 9, 10, 13, 16, 17, 18, 19, 21, 22 |
| `mhv-light-builder` | Haiku | Task 11 |
| `mhv-code-reviewer` | Opus | Every task, after the builder hands in |
| `mhv-slop-reviewer` | Opus | Every task that adds a screen or user-facing text |

Loop for each task: the architect sends the task text plus the Global Constraints as the brief; the builder works test-first and hands in with test output; the code reviewer passes or returns it; for screens, the slop reviewer checks screenshots at 360, 768 and 1440. Two returns on one task and the architect rewrites the brief or moves it up a model. Tasks run in order, except where a phase note says two may run in parallel.

Each phase is a branch (`phase-0-team` to `phase-6-ship`) merged to `main` after its last task passes. Each task ends with one commit named in its last step.

## Review Focus

1. **A photo that is not a readable document** (blurry, blank, a 12 MB phone photo): the scan ends on the manual-entry form with the image beside it, with no crash and no invented fields. Pinned in Tasks 12 and 13.
2. **A share link that ends while the clinician has it open**: the next load or verify shows "This link has ended" and no record data. Pinned in Tasks 15 and 17.
3. **A save while offline or on a dropped connection**: the form keeps what was typed, says it was not saved, and a retry does not create two records. Pinned in Task 9.
4. **Records with missing fields** (no date, no dose, no generic name): timeline, summary, reminders and emergency card render without "undefined", "null" or "Invalid Date". Pinned in Tasks 5 and 8.
5. **Device storage cleared or unavailable** (private browsing): the emergency card page says no card is saved on this device, and the PIN lock turns itself off, with no blank screen. Pinned in Task 18.

---

## Phase 0: Team

### Task 1: Team files and rules (Architect)

**Files:**
- Create: `.claude/agents/mhv-senior-builder.md`, `mhv-builder.md`, `mhv-light-builder.md`, `mhv-code-reviewer.md`, `mhv-slop-reviewer.md`
- Create: `CLAUDE.md`, `docs/rules/no-slop.md`, `.gitignore`

**Produces:** the five agent names above, each with `model:` set in frontmatter (`opus`, `sonnet`, `haiku`, `opus`, `opus`).

- [ ] **Step 1: Write the three builder agents.** Each body states: read `CLAUDE.md`, the spec and `docs/rules/no-slop.md` first; work test-first; touch only the files the brief names; never change a contract, apply a migration or deploy; hand in with the test command and its output, the files changed, and anything the brief got wrong.
- [ ] **Step 2: Write `mhv-code-reviewer`.** Read-only tools. Checks the diff against the brief's Files, Interfaces and tests, runs `npm test` and `npm run check:slop`, and returns PASS or a numbered list of required changes with `file:line`.
- [ ] **Step 3: Write `mhv-slop-reviewer`.** Read-only tools plus Playwright screenshots. Checks each new screen at 360, 768 and 1440 against `docs/rules/no-slop.md`, and every new string in `src/copy/`. Returns PASS or a numbered list.
- [ ] **Step 4: Write `docs/rules/no-slop.md`** from spec section 6, with the full banned-phrase list: welcome back, seamless, seamlessly, empower, journey, unlock, AI-powered, smart (as a label), effortless, supercharge, elevate, revolutionize, cutting-edge, game-changing, at your fingertips, peace of mind, take control, say goodbye to, oops, uh oh, whoops, hang tight, sit tight, awesome, magic. Banned class patterns: `bg-gradient-to-`, `bg-linear-to-`, `from-purple-`, `from-indigo-`, `via-purple-`, `to-purple-`, `to-indigo-`, `backdrop-blur`, `bg-clip-text`.
- [ ] **Step 5: Write `CLAUDE.md`**: where the spec, plan, rules and contracts are; the Global Constraints; the commands (`npm test`, `npm run check:slop`, `npm run test:e2e`, `npm run build`).
- [ ] **Step 6: Commit** on `phase-0-team`: `chore: add agent team, rules and project instructions` (include the spec and this plan).

### Task 2: Scaffold, toolchain and slop check (Sonnet)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css` (empty placeholder tokens), `vercel.json` (SPA rewrite to `/index.html`), `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_URL`)
- Create: `scripts/check-slop.mjs`, `scripts/check-slop.test.mjs`, `scripts/fixtures/slop/*`
- Create: `.github/workflows/ci.yml`

**Produces:** `npm test` (Vitest), `npm run check:slop`, `npm run build`, `npm run test:e2e` (Playwright, no specs yet).

`check-slop.mjs` exits 1 and prints `file:line: reason` when: a banned phrase (case-insensitive), `!` or `—` appears in a string in `src/copy/**`; a banned class pattern appears in `src/**/*.tsx`; an emoji appears anywhere in `src/**`; JSX text containing a letter appears in `src/screens/**` or `src/ui/**` (text must come from `src/copy/`).

- [ ] **Step 1: Write failing tests** in `scripts/check-slop.test.mjs` using fixture files:

```js
test('flags a banned phrase in copy', () => expect(run('copy-banned.ts')).toMatchObject({ code: 1, out: /seamless/i }));
test('flags an exclamation mark in copy', () => expect(run('copy-bang.ts').code).toBe(1));
test('flags an em dash in copy', () => expect(run('copy-emdash.ts').code).toBe(1));
test('flags a gradient class in a component', () => expect(run('gradient.tsx').code).toBe(1));
test('flags literal JSX text in a screen', () => expect(run('literal.tsx').code).toBe(1));
test('flags an emoji', () => expect(run('emoji.tsx').code).toBe(1));
test('passes clean files', () => expect(run('clean.tsx').code).toBe(0));
```

- [ ] **Step 2: Run** `npm test -- check-slop` and confirm they fail.
- [ ] **Step 3: Scaffold the app and implement `check-slop.mjs`** (takes optional path arguments; defaults to `src`).
- [ ] **Step 4: Run** `npm test`, `npm run check:slop`, `npm run build`. All pass.
- [ ] **Step 5: CI** runs the same three commands on push.
- [ ] **Step 6: Commit**: `chore: scaffold app and add slop check`. Merge `phase-0-team`.

---

## Phase 1: Foundations

Tasks 3, 4 and 5 touch different files and may run in parallel.

### Task 3: Design direction, mockups and tokens (Architect, owner approval gate)

**Files:**
- Create: `docs/design/direction.md`, `docs/design/mockups/{home,timeline,scan-confirm,clinician,emergency}.html`
- Modify: `src/styles/tokens.css`

**Produces:** CSS custom properties consumed by every screen: `--color-bg`, `--color-surface`, `--color-ink`, `--color-ink-muted`, `--color-line`, `--color-accent`, `--color-danger`, `--color-trust-patient`, `--color-trust-document`, `--color-trust-clinician`, `--font-sans`, `--font-mono`, `--text-xs` to `--text-2xl`, `--space-1` to `--space-8`, `--radius-sm`, `--radius-md`, light and dark values for each colour.

- [ ] **Step 1:** Load `craftwork-design` and `emil-design-eng`. Choose one direction for a calm clinical record tool; write it to `direction.md` (type pairing, palette, spacing, radius, motion, how the three trust labels look).
- [ ] **Step 2:** Build the five mockups as static HTML with seeded content at 360 wide, light and dark.
- [ ] **Step 3:** Show the owner. Revise until approved. Nothing in Phase 2 starts before approval.
- [ ] **Step 4:** Write the approved values into `tokens.css`.
- [ ] **Step 5: Commit**: `design: lock direction and tokens`.

### Task 4: Schema, row-level security, storage and seed (Opus)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_seed.sql`
- Create: `tests/integration/rls.test.ts`, `docs/contracts/database.md`

**Produces:**
- Tables: `profiles(id uuid pk = auth.uid, display_name, birth_date, sex, blood_type, emergency_contacts jsonb, emergency_consent bool default false, keep bool default false, gemini_reads int default 0, created_at)`; `records(id, user_id, type, title, occurred_on date null, details jsonb, provider_name, notes, status, trust_level, document_id, verified_by, verified_license, verified_at, created_at, updated_at)`; `documents(id, user_id, storage_path, kind, extraction jsonb, extraction_status, created_at)`; `shares(id, user_id, label, record_ids uuid[], token_hash text unique, expires_at, revoked_at, created_at)`; `share_access_log(id, share_id, action 'viewed'|'verified', record_id null, device text, created_at)`; `reminder_dismissals(user_id, reminder_key, primary key both)`; `usage_counters(day date pk, gemini_reads int)`.
- Enums match `RecordType`, `TrustLevel`, `RecordStatus` in Task 5.
- Private bucket `documents`, object path `<user_id>/<document_id>.jpg`.
- Row-level security: an owner reads and writes only their own rows; `share_access_log` is readable by the share's owner and writable by nobody from the client; `usage_counters` has no client access.
- `seed_demo_data()` (security definer, callable by the signed-in user): deletes that user's rows, then inserts the patient below with dates relative to `current_date`.
- `delete_my_data()`: deletes every row the caller owns.

Seed patient: Lourdes Villareal, born 12 Mar 1968, female, blood type O+, two emergency contacts. Providers: San Rafael Medical Center, Barangay Malaya Health Center, Lakandula Diagnostics. Records, at least 14 across all seven types and all three trust levels, including: type 2 diabetes (active), hypertension (active), penicillin allergy (rash, moderate), Metformin 500 mg twice daily (active), Glucophage 500 mg twice daily (active, so a possible-duplicate reminder shows), Losartan 50 mg once daily ending in 5 days, an HbA1c result of 7.2 %, an influenza immunization, a cataract procedure, and a visit with a follow-up 10 days ahead.

- [ ] **Step 1: Write failing integration tests** (two anonymous sessions, A and B, against the real project):

```ts
it('B cannot read A\'s records', async () => expect((await b.from('records').select()).data).toHaveLength(0));
it('B cannot update A\'s record', async () => expect((await b.from('records').update({ title: 'x' }).eq('id', aRecordId).select()).data).toHaveLength(0));
it('a client cannot insert into share_access_log', async () => expect((await a.from('share_access_log').insert({ share_id, action: 'viewed' })).error).not.toBeNull());
it('B cannot download A\'s document', async () => expect((await b.storage.from('documents').download(aPath)).error).not.toBeNull());
it('seed gives at least 14 records over 7 types', ...);
it('seed twice leaves the same count', ...);
```

- [ ] **Step 2:** Write the three migrations and `docs/contracts/database.md`.
- [ ] **Step 3 (architect):** Owner enables anonymous sign-ins in the Supabase dashboard; architect applies the migrations and runs the security advisor.
- [ ] **Step 4: Run** `npm run test:integration`. All pass.
- [ ] **Step 5: Commit**: `feat: add schema, access rules and demo seed`.

### Task 5: Domain core (Sonnet)

**Files:**
- Create: `src/domain/types.ts`, `dates.ts`, `trust.ts`, `generics.ts`, `summary.ts`, `reminders.ts`, each with a `.test.ts` beside it

**Produces:**

```ts
type RecordType = 'diagnosis'|'allergy'|'medication'|'lab_result'|'immunization'|'procedure'|'visit';
type TrustLevel = 'patient_entered'|'document_supported'|'clinician_verified';
type RecordStatus = 'active'|'resolved';
type RecordDetails =
  | { kind: 'diagnosis' } | { kind: 'procedure' }
  | { kind: 'allergy'; reaction: string|null; severity: 'mild'|'moderate'|'severe'|null }
  | { kind: 'medication'; genericName: string|null; dose: string|null; frequency: string|null; startOn: string|null; endOn: string|null }
  | { kind: 'lab_result'; results: { name: string; value: string; unit: string|null; referenceRange: string|null }[] }
  | { kind: 'immunization'; doseNumber: string|null }
  | { kind: 'visit'; reason: string|null; followUpOn: string|null };
interface HealthRecord { id: string; userId: string; type: RecordType; title: string; occurredOn: string|null; details: RecordDetails; providerName: string|null; notes: string|null; status: RecordStatus; trustLevel: TrustLevel; documentId: string|null; verifiedBy: string|null; verifiedLicense: string|null; verifiedAt: string|null; createdAt: string; updatedAt: string }
interface CandidateRecord { type: RecordType; title: string; occurredOn: string|null; details: RecordDetails; providerName: string|null }
interface Profile { id: string; displayName: string; birthDate: string|null; sex: string|null; bloodType: string|null; emergencyContacts: { name: string; relation: string; phone: string }[]; emergencyConsent: boolean }
interface Reminder { key: string; kind: 'follow_up'|'prescription_ending'|'possible_duplicate'; recordIds: string[]; dueOn: string|null }
interface Summary { conditions: HealthRecord[]; allergies: HealthRecord[]; medications: HealthRecord[]; recentLabs: HealthRecord[]; lastVisits: HealthRecord[] }

formatDate(iso: string|null): string            // '14 Nov 2026'; null or invalid -> ''
trustForNew(source: 'manual'|'scan'): TrustLevel
trustAfterEdit(before: HealthRecord, after: Pick<HealthRecord,'title'|'occurredOn'|'details'|'status'>): TrustLevel
toGeneric(name: string): string                 // lower-case generic, dose and form stripped
buildSummary(records: HealthRecord[]): Summary  // active only for conditions/allergies/medications; 3 newest labs and visits
computeReminders(records: HealthRecord[], today: string, dismissed: Set<string>): Reminder[]
```

All dates are `YYYY-MM-DD` strings. Reminder rules: `follow_up` when a visit's `followUpOn` is from 30 days before to 30 days after `today` (key `follow_up:<id>`); `prescription_ending` when an active medication's `endOn` is from `today` to `today + 7` inclusive (key `rx_end:<id>`); `possible_duplicate` when two or more active medications share `toGeneric(details.genericName ?? title)` (key `dup:<generic>`). Sorted by `dueOn`, duplicates first. `generics.ts` holds about 30 Philippine brand names (Biogesic, Glucophage, Lifezar, Norvasc, Ventolin, Neobloc and so on), with a header comment marking it a demo list.

- [ ] **Step 1: Write failing tests**, including:

```ts
expect(formatDate('2026-11-14')).toBe('14 Nov 2026');
expect(formatDate(null)).toBe(''); expect(formatDate('not a date')).toBe('');
expect(trustForNew('manual')).toBe('patient_entered'); expect(trustForNew('scan')).toBe('document_supported');
expect(trustAfterEdit(verified, { ...verified, title: 'changed' })).toBe('patient_entered');
expect(trustAfterEdit(verified, verified)).toBe('clinician_verified');   // only provider or notes changed
expect(toGeneric('Glucophage 500 mg tablet')).toBe('metformin'); expect(toGeneric('METFORMIN')).toBe('metformin');
expect(computeReminders([metformin, glucophage], today, new Set()).map(r => r.key)).toContain('dup:metformin');
expect(computeReminders([endsIn7], today, new Set())).toHaveLength(1); expect(computeReminders([endsIn8], today, new Set())).toHaveLength(0);
expect(computeReminders([resolvedMetformin, glucophage], today, new Set())).toHaveLength(0);
expect(computeReminders([metformin, glucophage], today, new Set(['dup:metformin']))).toHaveLength(0);
// Review Focus 4: missing fields
expect(() => computeReminders([medWithNullEverything, visitWithNoFollowUp], today, new Set())).not.toThrow();
expect(buildSummary([recordWithNullDate]).conditions).toHaveLength(1);
```

- [ ] **Step 2: Run** `npm test -- src/domain`; confirm failure.
- [ ] **Step 3: Implement** the six files.
- [ ] **Step 4: Run** `npm test -- src/domain`; all pass.
- [ ] **Step 5: Commit**: `feat: add domain types, trust rules, summary and reminders`.

### Task 6: Data layer and session (Sonnet)

**Files:**
- Create: `src/data/supabase.ts`, `mappers.ts`, `session.ts`, `records.ts`, `profile.ts`, `documents.ts`, `reminders.ts`, `queryClient.ts`, with tests for `mappers.ts` and `records.ts`

**Consumes:** Task 4 tables, Task 5 types.

**Produces:**

```ts
startDemo(): Promise<void>            // anonymous sign-in; calls seed_demo_data() when the user has no profile
resetDemo(): Promise<void>            // seed_demo_data()
listRecords(): Promise<HealthRecord[]>
getRecord(id: string): Promise<HealthRecord>
createRecord(input: CandidateRecord & { notes: string|null; status: RecordStatus; source: 'manual'|'scan'; documentId: string|null; clientId: string }): Promise<HealthRecord>
updateRecord(before: HealthRecord, patch: Partial<Pick<HealthRecord,'title'|'occurredOn'|'details'|'status'|'providerName'|'notes'>>): Promise<HealthRecord>
deleteRecord(id: string): Promise<void>
getProfile(): Promise<Profile>; updateProfile(patch: Partial<Profile>): Promise<Profile>
uploadDocument(file: Blob, kind: string): Promise<{ id: string; storagePath: string }>
documentUrl(storagePath: string): Promise<string>     // signed URL, 10 minutes
dismissReminder(key: string): Promise<void>; listDismissed(): Promise<Set<string>>
```

`createRecord` uses `clientId` as the row id, so a retried save cannot insert twice. `updateRecord` sets `trust_level` from `trustAfterEdit` and clears the verifier fields when trust drops. `queryClient.ts` persists the query cache to local storage so last-fetched records read offline.

- [ ] **Step 1: Write failing tests**: row-to-record mapping both ways; `createRecord` called twice with one `clientId` yields one row (mocked client, upsert on id); `updateRecord` with a title change sends `trust_level: 'patient_entered'` and null verifier fields; with a notes-only change it does not send `trust_level`.
- [ ] **Step 2: Run**, confirm failure. **Step 3: Implement.** **Step 4: Run**, all pass.
- [ ] **Step 5: Commit**: `feat: add data layer and demo session`.

### Task 7: App shell, shared components and copy (Sonnet)

**Files:**
- Create: `src/copy/{index,common,trust,nav}.ts`, `src/ui/{Screen,BottomNav,DemoMarker,TrustBadge,EmptyState,ErrorState,Skeleton,Button,Field}.tsx`, `src/screens/DemoEntry.tsx`, tests for `TrustBadge` and `DemoEntry`
- Modify: `src/App.tsx`

**Consumes:** `startDemo`, tokens.

**Produces:** routes `/` (DemoEntry), `/home`, `/timeline`, `/add`, `/records/:id`, `/records/:id/edit`, `/scan`, `/scan/confirm`, `/share`, `/share/new`, `/share/:id`, `/s/:token`, `/emergency`, `/settings`, `/print`; `<Screen title>` (page frame with DemoMarker and BottomNav); `<TrustBadge level>`.

Fixed copy: demo marker `Demo data`; entry button `Try the demo`; entry note `This is a public demo with a made-up patient. Do not enter real medical information.`; trust labels `Entered by patient`, `Supported by a document`, `Verified by a clinician`; nav items `Home`, `Timeline`, `Add`, `Share`, `Settings`; caution line `This is a reminder, not medical advice. Ask your doctor or pharmacist before changing any medicine.`

- [ ] **Step 1: Write failing tests**: `TrustBadge` renders each of the three labels; `DemoEntry` calls `startDemo` once and routes to `/home`; on failure it shows the error state with a retry button and stays on `/`.
- [ ] **Step 2: Run**, confirm failure. **Step 3: Implement.** **Step 4: Run** `npm test` and `npm run check:slop`.
- [ ] **Step 5: Commit**: `feat: add app shell, shared components and demo entry`. Merge `phase-1-foundations`.

---

## Phase 2: Records

Tasks 8, 9 and 10 may run in parallel after Task 7.

### Task 8: Timeline and record detail (Sonnet)

**Files:** Create `src/screens/Timeline.tsx`, `RecordDetail.tsx`, `src/ui/RecordRow.tsx`, `src/copy/{timeline,records}.ts`, tests for both screens.

**Consumes:** `listRecords`, `getRecord`, `documentUrl`, `formatDate`, `TrustBadge`.

Timeline groups by year, newest first, records with no date last under `Date not recorded`; filter chips for the seven types. Detail shows every field for the type, the trust badge, the verifier when verified, and the linked document image.

- [ ] **Step 1: Write failing tests**: seeded records render newest first; the `medication` filter leaves only medications; empty list shows the empty state with an `Add a record` action; a failed load shows the error state. Review Focus 4: a record with `occurredOn: null`, null dose and null provider renders, and the page text contains none of `undefined`, `null`, `Invalid Date`. A 200-character title wraps without horizontal scroll at 360 wide (Playwright).
- [ ] **Step 2: Run**, confirm failure. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add timeline and record detail`.

### Task 9: Add and edit a record by hand (Sonnet)

**Files:** Create `src/screens/AddRecord.tsx`, `RecordForm.tsx`, `src/copy/form.ts`, tests.

**Consumes:** `createRecord`, `updateRecord`, `deleteRecord`.

**Produces:** `<RecordForm initial?: CandidateRecord | HealthRecord onSaved(record)>`, reused by Task 13.

`AddRecord` offers `Scan a document` and `Enter by hand`, then the type. The form shows the fields for the chosen type. Title is required; everything else may be empty. Editing a verified record warns before saving: `Changing this will remove the clinician's verification.`

- [ ] **Step 1: Write failing tests**: each of the seven types saves the right `details.kind`; a manual save has `trustLevel: 'patient_entered'`; an empty title blocks the save with a field message. Review Focus 3: when `createRecord` rejects, the typed values are still in the form and the message `Not saved. Check your connection and try again.` shows; pressing save again reuses the same `clientId`.
- [ ] **Step 2: Run**, confirm failure. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add manual record entry and editing`.

### Task 10: Home, health summary and reminders (Sonnet)

**Files:** Create `src/screens/Home.tsx`, `src/ui/{SummarySection,ReminderCard}.tsx`, `src/copy/{home,reminders}.ts`, tests.

**Consumes:** `buildSummary`, `computeReminders`, `listDismissed`, `dismissReminder`.

Summary sentences are fixed templates in `src/copy/home.ts` filled from record fields only. Reminder text: follow-up `Follow-up due {date} at {provider}`; ending `{title} runs out on {date}`; duplicate `Possible duplicate: {titles} may be the same medicine ({generic})`. Each reminder card ends with the caution line.

- [ ] **Step 1: Write failing tests**: seeded data shows two conditions, one allergy, three medications; the duplicate reminder names Metformin and Glucophage; dismissing a reminder removes it and calls `dismissReminder('dup:metformin')`; with no records, each section shows its own empty line; every reminder card contains the caution line.
- [ ] **Step 2: Run**, confirm failure. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add home summary and reminders`. Merge `phase-2-records`.

---

## Phase 3: Scan

### Task 11: Sample documents (Haiku)

**Files:** Create `scripts/make-samples.mjs`, `scripts/samples/{prescription,lab-report,discharge}.html`, `public/samples/*.png`, `src/domain/extract/samples.ts`, `samples.test.ts`.

**Produces:** `SAMPLES: { id: 'prescription'|'lab-report'|'discharge'; imagePath: string; candidates: CandidateRecord[] }[]`.

Each HTML page is a typed document from a fictional provider for Lourdes Villareal with a diagonal `SAMPLE` stamp, rendered to a 1200 px wide PNG by Playwright. `candidates` is written by hand to match the page exactly.

- [ ] **Step 1: Write failing tests**: three samples; every `imagePath` exists under `public/`; prescription has 3 medication candidates; lab report has 1 `lab_result` candidate with 4 results; discharge has 1 diagnosis, 1 procedure and 1 visit.
- [ ] **Step 2: Run**, fail. **Step 3:** Write pages, render, write `samples.ts`. **Step 4: Run**, pass.
- [ ] **Step 5: Commit**: `feat: add sample documents with saved results`.

### Task 12: On-device reading and parsing (Opus)

**Files:** Create `src/domain/extract/{ocr,parse,image}.ts`, `parse.test.ts`, `image.test.ts`, `tests/fixtures/ocr/*.txt`.

**Produces:**

```ts
const LOW_CONFIDENCE = 70;
prepareImage(file: Blob): Promise<Blob>            // longest side at most 2000 px, JPEG
readImage(file: Blob): Promise<{ text: string; confidence: number }>   // tesseract.js, English, worker loaded on demand
parseDocumentText(text: string): CandidateRecord[]
needsHelp(read: { confidence: number }, candidates: CandidateRecord[]): boolean   // confidence < 70 or no candidates
```

Parser rules: provider is the first non-empty line; the document date is the first date found (`14 Nov 2026`, `11/14/2026`, `2026-11-14`, `November 14, 2026`); a medication line is a name followed by a dose (`mg`, `mcg`, `g`, `mL`, `IU`), with frequency taken from `once|twice|three times ... daily`, `OD`, `BID`, `TID`, `QID`, `every N hours`; a lab line is a name, a number, an optional unit and an optional range. Text that fits no rule is dropped. A field that cannot be read is `null`.

- [ ] **Step 1: Write failing tests** on text fixtures:

```ts
expect(parseDocumentText(prescriptionTxt)).toHaveLength(3);
expect(parseDocumentText(prescriptionTxt)[0]).toMatchObject({ type: 'medication', title: 'Metformin', details: { dose: '500 mg', frequency: 'twice daily' } });
expect(parseDocumentText(labTxt)[0].details).toMatchObject({ kind: 'lab_result', results: expect.arrayContaining([{ name: 'HbA1c', value: '7.2', unit: '%', referenceRange: '4.0-5.6' }]) });
expect(parseDocumentText('Losartan tablet once daily')[0].details.dose).toBeNull();   // no dose on the page -> null, not guessed
// Review Focus 1
expect(parseDocumentText('')).toEqual([]); expect(parseDocumentText('asdf ;;; 123 ###')).toEqual([]);
expect(needsHelp({ confidence: 91 }, [])).toBe(true); expect(needsHelp({ confidence: 40 }, [c])).toBe(true); expect(needsHelp({ confidence: 91 }, [c])).toBe(false);
```

`image.test.ts`: a 4000 × 3000 input comes back with longest side 2000.

- [ ] **Step 2: Run**, fail. **Step 3: Implement.** **Step 4: Run**, pass; also run `readImage` on the three sample PNGs once and record the candidate counts in the hand-in.
- [ ] **Step 5: Commit**: `feat: add on-device document reading and parsing`.

### Task 13: Scan capture and confirm screens (Sonnet)

**Files:** Create `src/screens/ScanCapture.tsx`, `ScanConfirm.tsx`, `src/copy/scan.ts`, tests.

**Consumes:** `SAMPLES`, `prepareImage`, `readImage`, `parseDocumentText`, `needsHelp`, `uploadDocument`, `RecordForm`, `createRecord`, and `readWithGoogle` from Task 14 (stub until then).

Capture offers `Take a photo` and `Choose a photo` (file inputs, `accept="image/*"`, the first with `capture="environment"`) and the three samples. Notice on the screen: `This is a public demo. Do not upload real medical documents.` Confirm shows the image beside one editable card per candidate, each with `Save` and `Discard`; saved records get `source: 'scan'` and the document id. When `needsHelp` is true the screen shows `The app could not read this page clearly.` with `Read with Google AI` and `Type it in myself`.

- [ ] **Step 1: Write failing tests**: tapping a sample goes to confirm with that sample's candidates and makes no call to `readImage`; saving a candidate calls `createRecord` with `source: 'scan'`; discarding all candidates saves nothing; the notice is on the capture screen. Review Focus 1: when `readImage` returns confidence 20 and no candidates, the help choice shows, and `Type it in myself` opens an empty `RecordForm` beside the image; when `readImage` throws, the same manual path shows with no crash.
- [ ] **Step 2: Run**, fail. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add scan capture and confirmation`.

### Task 14: Google AI reading for unclear pages (Opus)

**Files:** Create `supabase/functions/read-document/{index,prompt,schema}.ts`, `index.test.ts`, `src/data/readWithGoogle.ts`, `src/ui/GoogleConsent.tsx`, `docs/contracts/read-document.md`; modify `src/screens/ScanConfirm.tsx`, `src/copy/scan.ts`.

**Produces:** `POST /functions/v1/read-document` (signed-in user), body `{ documentId: string }` → `200 { candidates: CandidateRecord[] }`, `429 { error: 'limit' }`, `503 { error: 'unavailable' }`. Client: `readWithGoogle(documentId: string): Promise<{ ok: true; candidates: CandidateRecord[] } | { ok: false; reason: 'limit'|'unavailable' }>`.

The function checks the document belongs to the caller, checks `profiles.gemini_reads < 5` and today's `usage_counters.gemini_reads < GEMINI_DAILY_CAP`, increments both, sends the image to the Gemini API (`GEMINI_API_KEY`, `GEMINI_MODEL`) asking for JSON in the `CandidateRecord` shape, validates the reply and drops anything that does not fit. The prompt says to copy text exactly as written and return `null` for anything unreadable. Before writing, check Google's current free-tier limits and model names and set the default cap below the daily limit; record both in the contract file. A missing key returns 503.

Consent text, shown every time before the call: `Google AI can try to read this page. The photo will be sent to Google, and Google may use it to improve its products.` Buttons `Send to Google AI` and `Type it in myself`.

- [ ] **Step 1: Write failing tests** (Gemini call mocked): another user's document → 404; sixth read by one account → 429; daily cap reached → 429; no API key → 503; a reply with an unknown `type` is dropped; a valid reply returns candidates. Screen test: the function is not called until `Send to Google AI` is pressed; a `limit` or `unavailable` result opens the manual form with `Google AI is not available right now. You can type the details in.`
- [ ] **Step 2: Run**, fail. **Step 3: Implement.**
- [ ] **Step 4 (architect):** deploy the function; owner adds `GEMINI_API_KEY`. Run the tests, then one live read of a handwritten test page.
- [ ] **Step 5: Commit**: `feat: add opt-in Google AI reading for unclear pages`. Merge `phase-3-scan`.

---

## Phase 4: Sharing

### Task 15: Share links and verification functions (Opus)

**Files:** Create `src/domain/share.ts`, `share.test.ts`, `supabase/functions/_shared/{cors,token}.ts`, `supabase/functions/share-view/index.ts`, `supabase/functions/share-verify/index.ts`, tests for both, `docs/contracts/share.md`, `src/data/shares.ts`.

**Produces:**

```ts
const DURATIONS = [15, 60, 1440, 10080] as const;       // minutes
newShareToken(): Promise<{ token: string; tokenHash: string }>   // 32 random bytes, base64url; SHA-256 hex
shareUrl(token: string): string                          // `${VITE_PUBLIC_URL}/s/${token}`
createShare(input: { label: string; recordIds: string[]; minutes: 15|60|1440|10080 }): Promise<{ id: string; url: string; expiresAt: string }>
listShares(): Promise<Share[]>; getShareLog(shareId: string): Promise<AccessLogEntry[]>; revokeShare(id: string): Promise<void>
interface Share { id: string; label: string; recordIds: string[]; expiresAt: string; revokedAt: string|null; createdAt: string }
interface AccessLogEntry { id: string; action: 'viewed'|'verified'; recordId: string|null; device: string; createdAt: string }
```

`POST share-view` `{ token }` → `200 { patient: { displayName, birthDate, sex, bloodType }, records: HealthRecord[], expiresAt }` and logs `viewed`. `POST share-verify` `{ token, recordId, clinicianName, licenseNumber }` → `200 { record }`, sets `clinician_verified` with name, licence and time, and logs `verified`. Both return `410 { error: 'ended' }` for an unknown, expired or revoked token, with no other detail. `share-verify` returns `400` when the record is not in the share or the name or licence is blank. The raw token is never stored or logged. `shareUrl` uses `VITE_PUBLIC_URL` because the Android app's own origin is not the public site.

- [ ] **Step 1: Write failing tests**: token is 43 characters and two calls differ; hash is 64 hex characters; `shareUrl('abc')` ends `/s/abc`. Functions: valid token returns only the shared records; expired → 410; revoked → 410; unknown → 410 with the same body; verify outside the share → 400; verify sets the three verifier fields and writes one log row. Review Focus 2: a share revoked between a successful view and a verify returns 410 on the verify and leaves the record unchanged.
- [ ] **Step 2: Run**, fail. **Step 3: Implement.** **Step 4 (architect):** deploy both functions; run the tests.
- [ ] **Step 5: Commit**: `feat: add share links, audit log and verification functions`.

### Task 16: Share screens (Sonnet)

**Files:** Create `src/screens/{ShareList,ShareCreate,ShareDetail}.tsx`, `src/copy/share.ts`, tests.

**Consumes:** Task 15 client functions, `listRecords`.

Create: pick `Everything current`, a category, or individual records; pick a duration (`15 minutes`, `1 hour`, `24 hours`, `7 days`); name it. Detail: QR code, link with a `Copy link` button, time left, the access log, and `Stop sharing`. List: active first, then ended, each showing how many times it was opened.

- [ ] **Step 1: Write failing tests**: `Everything current` selects only active records; creating with `1 hour` calls `createShare` with `minutes: 60`; no records selected blocks creation; `Stop sharing` calls `revokeShare` and the share moves under ended; the log lists a `viewed` and a `verified` entry with times; an expired share shows `Ended` and no QR code.
- [ ] **Step 2: Run**, fail. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add share creation, list and audit log screens`.

### Task 17: Clinician view (Sonnet)

**Files:** Create `src/screens/ClinicianView.tsx`, `src/data/clinician.ts`, `src/copy/clinician.ts`, print styles, tests.

**Consumes:** `share-view`, `share-verify`.

Public page with no navigation and no sign-in. Shows patient name, age, sex and blood type, then records grouped by type with trust badges, and when the link ends. `Mark as verified` on each record asks once per visit for name and licence number, with the note `Demo only: the licence number is not checked.` Prints cleanly on A4.

- [ ] **Step 1: Write failing tests**: a valid token renders the shared records with badges; verifying a record calls `share-verify` and the badge changes to `Verified by a clinician`; the name and licence are asked once, then reused for the next record. Review Focus 2: a 410 on load shows `This link has ended` and no record text; a 410 on verify replaces the whole page with `This link has ended`.
- [ ] **Step 2: Run**, fail. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add clinician view with verification`. Merge `phase-4-sharing`.

---

## Phase 5: Safety net

### Task 18: Emergency card and PIN lock (Sonnet)

**Files:** Create `src/domain/{emergency,pin,storage}.ts` with tests, `src/screens/{EmergencyCard,PinLock}.tsx`, `src/copy/{emergency,pin}.ts`; modify `src/App.tsx`.

**Produces:**

```ts
safeStorage: { get(key): string|null; set(key, value): boolean; remove(key): void; available(): boolean }   // never throws
interface EmergencyCard { name: string; bloodType: string|null; allergies: string[]; conditions: string[]; medications: string[]; contacts: Profile['emergencyContacts']; savedAt: string }
buildEmergencyCard(profile: Profile, records: HealthRecord[]): EmergencyCard     // active records only
saveEmergencyCard(card): boolean; loadEmergencyCard(): EmergencyCard|null; clearEmergencyCard(): void   // key 'mhv.emergency.v1'
setPin(pin: string): Promise<boolean>; verifyPin(pin: string): Promise<boolean>; hasPin(): boolean; clearPin(): void   // key 'mhv.pin.v1', PBKDF2-SHA-256 with a random salt
```

The card is rebuilt and saved whenever records or profile change while consent is on, and cleared when consent is turned off. `/emergency` reads only from the device and makes no network call. The PIN is 4 digits; the app locks after 5 minutes in the background; 5 wrong tries force a 30 second wait. The lock screen has an `Emergency card` link, shown only when a card is saved. Consent text: `Anyone holding this phone can open the emergency card without your PIN.`

- [ ] **Step 1: Write failing tests**: the card lists the penicillin allergy, both conditions and active medications, and leaves out resolved records; `verifyPin` is true for the right PIN and false for a wrong one; the stored value does not contain the PIN; the lock appears after 5 minutes hidden (fake timers); the sixth try within the wait is refused; `/emergency` renders with the network blocked (Playwright, offline). Review Focus 5: with storage throwing on every call, `loadEmergencyCard()` returns `null`, `/emergency` shows `No emergency card is saved on this device.`, `setPin` returns `false`, and the app opens unlocked.
- [ ] **Step 2: Run**, fail. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add offline emergency card and PIN lock`.

### Task 19: Settings, export, delete and phone notifications (Sonnet)

**Files:** Create `src/screens/{Settings,PrintSummary}.tsx`, `src/data/{exportData,notifications}.ts` with tests, `src/copy/settings.ts`.

**Produces:** `exportAll(): Promise<Blob>` (JSON of profile, records, document list, shares, access log); `deleteEverything(): Promise<void>` (removes the user's files, calls `delete_my_data()`, clears device storage, signs out); `syncNotifications(reminders: Reminder[]): Promise<void>` (schedules Capacitor local notifications at 09:00 on `dueOn`; does nothing off a native platform).

Settings sections: profile and emergency contacts, emergency card consent, PIN, `Download my data`, `Print a summary`, `Reset demo data`, `Delete everything`, and a note that the brand-name list used for duplicate checks is a short demo list. Delete asks the user to type `delete`.

- [ ] **Step 1: Write failing tests**: the export parses as JSON and holds every seeded record; delete does nothing until `delete` is typed, then calls `deleteEverything` and routes to `/`; reset calls `resetDemo`; turning consent off calls `clearEmergencyCard`; `syncNotifications` makes no plugin call when `Capacitor.isNativePlatform()` is false and schedules one notification per dated reminder when true.
- [ ] **Step 2: Run**, fail. **Step 3: Implement.** **Step 4: Run** tests and `check:slop`.
- [ ] **Step 5: Commit**: `feat: add settings, export, delete and phone notifications`. Merge `phase-5-safety`.

---

## Phase 6: Ship

### Task 20: Cleanup and keep-awake job (Opus)

**Files:** Create `supabase/functions/cleanup/index.ts`, `index.test.ts`, `.github/workflows/daily.yml`.

**Produces:** `POST /functions/v1/cleanup` with header `x-cleanup-secret` → `200 { deletedUsers: number }`; `401` without the right secret. Deletes every anonymous user older than 7 days whose profile has `keep = false`: their stored files first, then the user (rows cascade). The workflow calls it daily at 18:00 UTC, which also keeps the free Supabase project from pausing.

- [ ] **Step 1: Write failing tests**: wrong secret → 401; a user 8 days old is deleted with their files; a user 6 days old stays; an 8-day-old user with `keep = true` stays.
- [ ] **Step 2: Run**, fail. **Step 3: Implement.**
- [ ] **Step 4 (architect):** deploy; set `CLEANUP_SECRET` in Supabase and as a GitHub Actions secret; set `keep = true` on the owner's account; run the workflow once by hand.
- [ ] **Step 5: Commit**: `feat: add daily cleanup of demo accounts`.

### Task 21: Installable web app, offline, end-to-end test and deploy (Sonnet)

**Files:** Modify `vite.config.ts` (`vite-plugin-pwa`), `index.html`; create `public/icons/*`, `src/ui/OfflineBanner.tsx`, `tests/e2e/{main-flow,offline}.spec.ts`.

Manifest name `MyHealthVault`, standalone display, icons from the approved direction. The service worker precaches the app shell, `/emergency` and the sample images. When offline, a banner reads `You are offline. Records are read-only until you reconnect.` and save, scan and share actions are disabled.

- [ ] **Step 1: Write failing end-to-end tests.** `main-flow`: try the demo → home shows the duplicate reminder → scan the prescription sample → save one candidate → it appears on the timeline as `Supported by a document` → create a 1 hour share → open the link in a second context → mark a record verified → the first context shows it verified and the log shows one view and one verification → stop sharing → the link shows `This link has ended`. `offline`: after one online visit, go offline; the timeline still lists records, `/emergency` opens, and the save button is disabled.
- [ ] **Step 2: Run** `npm run test:e2e`, fail. **Step 3: Implement.** **Step 4: Run**, pass, at 360 and 1440 wide.
- [ ] **Step 5 (architect):** set the three `VITE_` variables in Vercel, turn off deployment protection for production, deploy, and run `main-flow` against the live URL.
- [ ] **Step 6: Commit**: `feat: make the app installable and usable offline`.

### Task 22: Android APK, README and release (Sonnet)

**Files:** Create `capacitor.config.ts` (`appId: 'ph.myhealthvault.demo'`, `webDir: 'dist'`), `android/`, `README.md`, `docs/screenshots/*`; modify `package.json` (`build:android`).

`build:android` runs the web build with `VITE_PUBLIC_URL` set to the live site, then `npx cap sync android` and `gradlew assembleDebug`. The Android manifest declares camera and notification permissions. README, in this order: one sentence on what it is, the live link, four screenshots, how to install on iPhone (Safari, Share, Add to Home Screen) and Android (APK from Releases), what is real and what is simulated, how to run it locally, the model team that built it, the proposal reference. README text follows `docs/rules/no-slop.md`.

- [ ] **Step 1:** Add Capacitor and build the APK. Expected: `android/app/build/outputs/apk/debug/app-debug.apk` exists.
- [ ] **Step 2:** Install on a phone or emulator and walk the main flow, including a camera scan and a share link opened in the phone's browser. Record the result in the hand-in.
- [ ] **Step 3:** Write the README and capture screenshots from the live site at 390 wide.
- [ ] **Step 4:** Run `npm test`, `npm run check:slop` (include `README.md`), `npm run build`.
- [ ] **Step 5: Commit**: `feat: add Android build and README`. Merge `phase-6-ship`.
- [ ] **Step 6 (architect, owner confirms first):** tag `v0.1.0`, create the GitHub release with the APK attached, and make the repository public.

---

## Owner steps, in order

1. Approve the design mockups (Task 3).
2. Turn on anonymous sign-ins in Supabase: Authentication, Sign In / Providers (Task 4).
3. Create a free Gemini key at Google AI Studio with no billing and add it as the Supabase secret `GEMINI_API_KEY` (Task 14).
4. Confirm making the repository public (Task 22).

## Differences from the spec

- The camera uses the browser's own photo input on every platform, so the Capacitor camera plugin is not installed.
- Demo-account cleanup runs as an Edge Function called by a daily GitHub workflow, not a database job, because stored files have to be removed through the Storage API. The same call keeps the project awake.
