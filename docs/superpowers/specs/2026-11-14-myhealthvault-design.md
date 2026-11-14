# MyHealthVault: design

Date: 2026-11-14
Source: TeamPOG Final Proposal (hackathon proposal, one page)
Status: awaiting approval

## 1. Intent

Turn the MyHealthVault proposal into a working demo: a patient-controlled health history app that a stranger can try from a link on the owner's GitHub profile, and that the owner can show in person on a phone.

It is a demo. It runs on made-up patient data and is not meant to hold real medical records.

## 2. Goals, non-goals, anti-goals

**Goals**

- All five proposal features work end to end: scan-and-confirm capture, trust labels, time-limited sharing with revocation and an audit log, reminders, offline emergency card.
- A visitor goes from the README to using the app in under a minute, with no sign-up form.
- Runs on iPhone (installable web app) and Android (real APK), from one codebase.
- The interface and every piece of text the app produces read as made by a careful person, not generated.
- The build is run by a model team: Fable architects, plans and reviews; Opus and smaller models write the code.

**Non-goals**

- Hospital system integration (the proposal's later phase).
- Real clinician identity checks. Verification in the demo is simulated and labelled as such.
- Drug interaction checking, dosing advice, or anything that reads as a diagnosis.
- Client-side end-to-end encryption, Data Privacy Act compliance work, App Store or Play Store listing.
- Native iOS build. The code stays ready for it; it is switched on when an Apple Developer account exists.

**Anti-goals** (failure even if it works)

- Real patient data ending up in the demo database.
- The app stating or implying medical advice.
- Text the app invents: a summary sentence or extracted value that is not on the record or the scanned page.
- A generic AI-built look: purple gradients, emoji icons, filler marketing copy.

## 3. Approaches considered

| | A. Vite web app + Capacitor | B. Expo (React Native) | C. Installable web app only |
|---|---|---|---|
| Visitor from GitHub | One link, works at once | iPhone visitors must clone and run the project | One link |
| Android | Real APK | Real APK | Home-screen install only |
| iPhone without Apple account | Home-screen install | Expo Go, tied to the owner's laptop | Home-screen install |
| Fit with owner's other projects | Same stack as PATTS | New stack | Same stack |
| Web design skills | Apply fully | Apply as principles only | Apply fully |

**Picked: A.** The owner chose it after weighing Expo Go: the audience is people arriving from a GitHub profile, and only a hosted link gets tried. A also contains C, and keeps a native iOS build available later.

## 4. Architecture

Decided by the owner: demo scope, option A, iOS as installable web app, Android APK, taste rules applied to the UI, no deadline, and visitors on the public link may scan their own documents (with a notice on every upload screen and deletion after 7 days).

Everything below is the architect's call.

**Stack**

- Client: Vite, React, TypeScript, Tailwind CSS, React Router, TanStack Query.
- Installable web app: `vite-plugin-pwa` (manifest, service worker, offline shell).
- Android: Capacitor wrapping the same build. Plugins: camera, local notifications.
- Backend: Supabase. Auth, Postgres with row-level security, Storage for scanned images, Edge Functions for extraction and share links.
- Hosting: Vercel for the web app.
- Tests: Vitest for logic, Playwright for the main flows (as in Ops Pilot).

**Location:** `#4 MyHealthVault/` in this workspace, as its own git repository so it can be published to GitHub on its own.

**Data model** (Postgres, every table scoped to its owner by row-level security)

- `profiles`: name, birth date, sex, blood type, emergency contacts, emergency card consent.
- `records`: type (diagnosis, allergy, medication, lab result, immunization, procedure, visit), title, date, type-specific details (JSON), provider name, status (active or resolved), trust level, linked document, verifier name and time.
- `documents`: storage path, kind, extraction result, extraction status.
- `shares`: label, selected record ids, token hash, expiry, revoked time.
- `share_access_log`: share, time, action (viewed or verified), device summary.
- `reminder_dismissals`: which computed reminder the user dismissed.

**Trust labels**

- Typed in by hand: patient-entered.
- Created from a confirmed scan: document-supported, linked to the image.
- Marked by a clinician through a share link: clinician-verified, with name and licence number as typed. The demo does not check the licence and says so on screen.
- Editing a clinical field on a record drops it back to patient-entered.

**Scan capture**

1. User photographs a document, picks a photo, or taps one of three bundled sample documents (prescription, lab report, discharge summary, each stamped SAMPLE).
2. Image goes to Storage. The app reads the text on the device (Tesseract.js) and picks out fields by rules, giving one or more candidate records. This is the default path and sends the image to no AI service.
   - If the on-device read has low confidence, which is what handwriting produces, the app says so and offers "Read with Google AI". It names Google, says the photo will be sent there, and does nothing until the user agrees. Consent is asked per scan.
   - On agreement, an Edge Function sends the image to the Gemini API free tier and gets back structured fields.
   - If the user declines, or the free limit is reached, they fill the fields in by hand beside the image.
3. User sees each candidate beside the image, edits or rejects it, then saves.
4. Nothing is saved without confirmation. Fields the model could not read are left empty, never guessed.

The three sample documents use extraction results saved in the repository. They make no API call, do not count toward any limit, and keep working when the daily cap is reached or no API key is set.

The project must cost nothing to run, so no paid API is used. The Gemini key is a free-tier key with no billing attached, held only in the Edge Function, with the model name set by an environment variable. Limits on Gemini reads: 5 per demo account, and a daily cap across the app set below the free tier's own limit, which the builder checks in Google's current documentation before writing the function. A refused or failed Gemini call falls back to manual entry and never blocks the scan.

**Sharing**

- Patient picks records (all current, by category, or one by one) and a duration (15 minutes, 1 hour, 24 hours, 7 days).
- App shows a QR code and a link `/s/<token>`. The token is random; only its hash is stored.
- The clinician page is public, read-only and printable. It shows the selected records with trust labels, read live through an Edge Function that checks expiry and revocation and writes the audit log.
- Patient sees active and past shares, each with its access log, and can revoke.
- An expired or revoked link shows "This link has ended" on the next load or action, with no record data.

**Clinician verification**

- The clinician page is read-only except for one action: "Mark as verified", per record.
- The clinician types a name and licence number once per visit to the page; each verification goes through the share Edge Function and is written to the audit log.
- Verifying a record again replaces the earlier verifier and time.
- A verification survives edits to non-clinical fields (provider name, notes). It is lost when a clinical field changes.

**Health summary and timeline**

- Timeline: all records by date, filterable by type.
- Summary: current conditions, allergies, active medications, recent lab results, last visits. Built by fixed templates from record fields. No language model writes it.

**Reminders**

- Computed from records: follow-up dates, prescriptions ending within 7 days, possible duplicate medications.
- Duplicate check: same generic name active twice, using a small built-in table (about 30 entries) of common Philippine brand names to generics. Builders compile it; nobody clinical signs it off, so the notice always says "possible" and the table is labelled a demo list in the code and in Settings.
- Every duplicate notice ends with the same line telling the user to ask their doctor or pharmacist.
- Shown in the app on all platforms. The Android APK also raises phone notifications. The web version does not send notifications (this is a change from what was said in conversation; see section 9).

**Emergency card**

- Off by default. When the user consents, the card (allergies, conditions, medications, blood type, contacts) is stored on the device and its page is cached for offline use.
- Reachable from the app's own PIN screen without entering the PIN, through an "Emergency card" link. That is the point of it, and the consent screen says so. Nothing is shown on the phone's system lock screen.

**Offline**

- Works offline: the app shell, the emergency card, and read-only viewing of the records last fetched.
- Needs a connection: adding or editing records, scanning, sharing. No offline edits and no sync conflict handling.

**Privacy in the demo**

- Entry is a single "Try the demo" button: anonymous sign-in, then a seeded fictional patient with several years of records at fictional providers.
- A persistent "Demo data" marker, and a notice on every upload screen not to use real documents.
- Demo accounts and their files are deleted after 7 days by a scheduled job.
- The owner's own demo account is exempt: a `keep` flag on its profile, set by hand in Supabase, with no interface for it.
- Settings has "Reset demo data", which restores the seeded patient.
- 4-digit PIN app lock, held on the device. It is a privacy screen, not encryption.
- Export all data as JSON, a printable summary, and delete everything.
- Protection is Supabase encryption at rest, TLS and row-level security.

**Screens**

Demo entry, Home (summary and reminders), Timeline, Add (scan or manual), Scan confirm, Record detail, Share (create, list, audit log), Clinician view, Emergency card, Settings. Bottom navigation with five items.

## 5. The model team

| Role | Model | Does |
|---|---|---|
| Architect | Fable (the main session) | Design, plan, shared contracts, task briefs, final review, integration decisions. Writes no feature code. |
| Senior builder | Opus | Schema and row-level security, share-link function, extraction function, offline caching. |
| Builder | Sonnet | Feature screens and their tests. |
| Light builder | Haiku | Mechanical work: seed data entry, config, asset wiring. |
| Code reviewer | Opus | Checks each finished task against its brief and the tests. |
| Slop reviewer | Opus | Checks screens and text against the no-slop rules, from screenshots. |

These are project agent definitions in `#4 MyHealthVault/.claude/agents/`, each with its model fixed in the file. A project `CLAUDE.md` tells every agent where the rules and contracts are.

**Working rules**

- Contracts first. The architect writes the database schema, TypeScript types, function request and response shapes, and design tokens before any feature task starts. Builders may not change a contract; they report back.
- Briefs stand alone. A builder starts with no memory, so each brief names the files to touch, the contracts to use, the tests that must pass and what is out of scope.
- Parallel only when tasks touch different files.
- Every task ends with test output as evidence. A reviewer then passes or returns it.
- Two failed reviews on a task and the architect steps in: rewrites the brief or moves it up a model.
- Cheapest model that can do the task. Escalate on evidence, not in advance.
- Small mechanical tasks are batched into one brief, because every agent starts cold and re-reads the rules and contracts; spawning one agent per tiny task costs more than it saves.
- There is no deadline, so phases run in the order in section 7 and the mockup approval step stays.
- The owner runs the orchestrating session on Fable.

## 6. No-slop rules

One file, `docs/rules/no-slop.md`, binding on every builder. It covers the interface and all text, including the extraction prompt and summary templates.

**Look**

- One design direction, chosen once by the architect with the `craftwork-design` skill (backed by `emil-design-eng`), shown to the owner as mockups and approved before any feature screen is built. Then locked as tokens: one type pairing, one palette, one spacing scale, one radius scale, one icon set.
- Banned: purple or indigo gradients, gradient text, glass blur panels, emoji as icons, the same rounded shadowed card for everything, centred-everything layouts, decorative illustrations with no meaning, stock hero sections.
- Every screen has designed empty, loading and error states.
- Touch targets at least 44px. Checked at 360, 768 and 1440 wide.
- Clinical values in tabular figures with their units. One date format throughout (14 Nov 2026).

**Words**

- All interface text lives in one folder, `src/copy/`, so it can be reviewed in one place.
- Sentence case. No exclamation marks. No em dashes.
- Buttons name the action ("Share with a doctor"), not "Submit" or "Continue".
- Errors say what happened and what to do next.
- Banned phrases: "Welcome back", "seamless", "empower", "journey", "unlock", "AI-powered", "smart" as a label, and similar filler. The list lives in the rules file.
- The app never describes itself or its features in marketing terms inside the product.
- Clinical text is copied, not composed: drug names, doses, values and dates appear as on the record or the page.
- One standard caution line, reused, wherever the app touches medication or follow-up.

**Enforcement**

- A script fails the test run when a banned phrase or pattern appears in `src/copy/` or a banned class pattern appears in components.
- The slop reviewer checks screenshots of every new screen before the task is accepted.
- The extraction prompt is reviewed against the rules like any other text.

## 7. Phases

0. Team setup: repository, agent definitions, `CLAUDE.md`, rules file, lint script.
1. Foundations: design direction and mockups (owner approves), tokens, schema, types, app shell, demo sign-in and seed data.
2. Records: timeline, manual entry, record detail, health summary.
3. Scan capture and confirmation.
4. Sharing, clinician view, audit log, verification.
5. Reminders, emergency card, PIN lock, export and delete.
6. Ship: installable web app on Vercel, Android APK attached to a GitHub release, README with live link and screenshots.

Each phase ends in something that can be opened and tried.

## 8. Needed from the owner

- A free Gemini API key from Google AI Studio, with no billing set up, added as the Supabase secret `GEMINI_API_KEY`. Needed only for the handwriting path; everything else works without it.
- Go-ahead to create a Supabase project (free tier) and a Vercel project through the connected accounts.
- A GitHub repository to publish to.
- Approval of the design direction mockups in phase 1.

## 9. Architect's calls to check

- Web version shows reminders in the app only; phone notifications are Android APK only. Web notifications would need a push server, which is not worth it for a demo.
- Health summary is template-built, with no language model, to rule out invented clinical text.
- Clinician verification is simulated: name and licence number as typed, unchecked, labelled.
- "Try the demo" anonymous entry, with accounts deleted after 7 days.
- Scanning is on-device by default; Gemini free tier is used only for low-confidence reads and only after the user agrees each time (owner's decision, 15 Nov 2026).
- Gemini limits: 5 reads per account, plus a daily cap under the free tier's limit.
- A free scheduled ping keeps the Supabase project from pausing after a week of inactivity.
- Fictional patient and fictional provider names only; no real hospital names.
- The project is its own git repository inside `#4 MyHealthVault/`.
- Sample documents use saved extraction results, with no API call.
- Offline covers the shell, the emergency card and read-only cached records. No offline edits.
- The emergency card opens from the app's PIN screen, not the phone's lock screen.
- Verification is per record, and is lost when a clinical field is edited.
- The brand-to-generic table is builder-compiled, about 30 entries, labelled a demo list.
- The owner's account is kept by a hand-set flag; everyone else's is deleted after 7 days.

## 10. Left to the builders

Component structure, state handling inside a screen, test layout, exact Tailwind classes within the tokens, the wording of code comments, and internal naming, all within the contracts and rules above.
