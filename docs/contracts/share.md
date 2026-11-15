# Contract: share links

A patient shares chosen records with a clinician through a link `/s/<token>`. The clinician has no account. Owner: Task 15. Tables: `shares` and `share_access_log` in `docs/contracts/database.md`.

## Token

- 32 random bytes from `crypto.getRandomValues`, base64url without padding: 43 characters of `A-Z a-z 0-9 - _`.
- Stored only as `shares.token_hash`: SHA-256 of the token's UTF-8 bytes, 64 lowercase hex characters. The raw token is never stored, never logged and never sent to the database.
- The client (`src/domain/share.ts`, `sha256Hex`) and the functions (`supabase/functions/_shared/token.ts`, `hashToken`) hash the same way; a test checks they agree.
- The link holds the only copy of the token. It cannot be rebuilt later from `listShares`, so the app shows it (link and QR code) right after `createShare`.

## Client

`src/domain/share.ts`:

```ts
const DURATIONS = [15, 60, 1440, 10080] as const;            // minutes
newShareToken(): Promise<{ token: string; tokenHash: string }>
shareUrl(token: string): string                              // `${VITE_PUBLIC_URL}/s/${token}`
shareState(share: { expiresAt; revokedAt }, now: Date): 'active' | 'ended'
interface Share { id: string; label: string; recordIds: string[]; expiresAt: string; revokedAt: string | null; createdAt: string }
interface AccessLogEntry { id: string; action: 'viewed' | 'verified'; recordId: string | null; device: string; createdAt: string }
```

`shareUrl` uses `VITE_PUBLIC_URL` (trailing slash removed) because the Android app's own origin is not the public site. Only when it is unset does it fall back to the page's origin.

`src/data/shares.ts`, signed-in client under row-level security:

| Function | Does |
|---|---|
| `createShare({ label, recordIds, minutes })` → `{ id, url, expiresAt }` | Makes a token, inserts `label` (trimmed, at most 200), `record_ids` (duplicates removed, at least one), `token_hash`, `expires_at` (now + minutes). Throws before any call for no records, a duration not in `DURATIONS`, or a label over 200. The database rejects a record id the user does not own (`42501`). |
| `listShares()` → `Share[]` | Newest first. Never selects `token_hash`. |
| `getShareLog(shareId)` → `AccessLogEntry[]` | Newest first. |
| `revokeShare(id)` | Sets `revoked_at` to now where it is still null. Revoking twice changes nothing and does not fail. |

`expires_at` is computed from the device clock; the database requires it to be after `created_at` (server time), so a device clock more than 15 minutes slow fails a 15-minute share.

## Edge Functions

`POST /functions/v1/share-view` and `POST /functions/v1/share-verify`. Both are public: deployed with `verify_jwt = false`, because clinicians have no account. The token in the body is the only key. Both use the service role and scope every query by hand to one share and its owner.

### share-view

Body: `{ "token": string }`.

`200`:

```json
{
  "patient": { "displayName": "Lourdes Villareal", "birthDate": "1968-03-12", "sex": "female", "bloodType": "O+" },
  "records": [HealthRecord, ...],
  "expiresAt": "2026-11-16T11:00:00+00:00"
}
```

- `patient` has exactly these four fields, selected alone from `profiles`. No emergency contacts, consent, counters or other columns. A missing profile gives `displayName: ""` and nulls.
- `records` are the share's records loaded with `id = any(record_ids) and user_id = share.user_id`, newest `occurred_on` first, nulls last. Stale ids find nothing. The handler checks owner and membership again on the rows it gets back.
- Each record is in the `HealthRecord` shape with two fields blanked: `userId` is always `""` (the owner's account id is not shown) and `documentId` is always `null` (documents and images are never exposed). No other column is sent.
- One `viewed` row is written to `share_access_log` before the answer is sent. If that write fails, the answer is 503 and no record is sent.

### share-verify

Body: `{ "token": string, "recordId": string, "clinicianName": string, "licenseNumber": string }`.

`200 { "record": HealthRecord }` in the same shape as share-view.

Order of checks:

1. Body is a JSON object of at most 4096 bytes, and all four fields are strings, else 400 (413 when over the size).
2. The share is live at this moment, else 410. This comes before every other check, so a link that ended while the page was open always answers 410 and changes nothing.
3. `clinicianName` and `licenseNumber` are trimmed. Blank, containing a control character, or over 200 (name) or 100 (licence) characters: 400.
4. `recordId` is a uuid listed in the share's `record_ids`, and the record exists with `user_id = share.user_id`, else 400.
5. If the record is already `clinician_verified` (by anyone), it is left as it is: 200 with the record unchanged, nothing logged. A verification is never overwritten through a share link.
6. One update sets `trust_level = 'clinician_verified'`, `verified_by`, `verified_license` and `verified_at` (server time) together, filtered by `id`, `user_id` and `trust_level <> 'clinician_verified'`. If two clinicians press at once, one update wins; the other gets 200 with the winner's verification and logs nothing.
7. One `verified` row is written to `share_access_log` with the record id. If that write fails the answer is 503, but the record stays verified; a retry answers 200 under step 5.

### Both functions

| Status | Body | When |
|---|---|---|
| 200 | above | |
| 400 | `{ "error": "bad_request" }` | Body is not a JSON object, a field is missing or the wrong type; for share-verify also steps 3 and 4. |
| 405 | `{ "error": "method_not_allowed" }` | A method other than `POST` or `OPTIONS`. |
| 410 | `{ "error": "ended" }` | The token is malformed, unknown, expired (`expires_at <= now`) or revoked (`revoked_at` set). All four are the same answer, body and headers. |
| 413 | `{ "error": "too_large" }` | Body over 4096 bytes. Reading stops at the cap. |
| 503 | `{ "error": "unavailable" }` | Any database failure. No detail is sent and nothing is logged to the console. |

- Expiry and revocation are checked on every call, view and verify alike.
- A token that is not 43 base64url characters is not looked up. A valid-looking token is hashed and looked up by `token_hash` only.
- The access log `device` is the `User-Agent` header with control characters replaced, trimmed, cut to 200 characters. No IP address is stored.
- CORS: `Access-Control-Allow-Origin: *`, methods `POST, OPTIONS`, headers `authorization, x-client-info, apikey, content-type`. Credentials are never allowed. Every JSON answer carries `Cache-Control: no-store`.
- What a token holder can reach: the four patient fields, the share's own records that still exist, and verification of those records. Nothing else, and no way to list other shares, records or users.

Known limit: the share is checked, then the record is updated, in two steps (no SQL function was added). A revoke that lands in the milliseconds between them lets that one verify through. The access log shows it.

## Files per function

- `share-view`: `share-view/index.ts`, `share-view/handler.ts`, `_shared/cors.ts`, `_shared/token.ts`, `_shared/share.ts`, `_shared/db.ts`.
- `share-verify`: `share-verify/index.ts`, `share-verify/handler.ts`, and the same four `_shared` files.
- `_shared/testing.ts` and the `*.test.ts` files are for Vitest only and are not deployed.

## Environment

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, provided by Supabase. No other secret.
