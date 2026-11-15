# Contract: read-document

Optional Google AI reading for a scanned page the app could not read on the device. Owner: Task 14.

## Endpoint

`POST /functions/v1/read-document`, called by a signed-in user (anonymous sign-ins included). The Supabase client sends the session token as `Authorization: Bearer <token>`.

Body: `{ "documentId": "<uuid>" }`, the id of a row in `documents` that the caller owns.

| Status | Body | When |
|---|---|---|
| 200 | `{ "candidates": CandidateRecord[] }` | The page was read. The list may be empty. |
| 400 | `{ "error": "bad_request" }` | Body is not JSON or has no `documentId`. |
| 401 | `{ "error": "unauthorized" }` | No valid session token. |
| 404 | `{ "error": "not_found" }` | The id is not a uuid, does not exist, or belongs to someone else. The three cases look the same. |
| 413 | `{ "error": "too_large" }` | The stored image is over 10 MB (10485760 bytes). |
| 415 | `{ "error": "not_image" }` | The stored file is not JPEG, PNG or WebP. |
| 429 | `{ "error": "limit" }` | The account has used its 5 reads, or the app reached today's cap. |
| 503 | `{ "error": "unavailable" }` | `GEMINI_API_KEY` is not set, Google failed or answered with something that is not JSON, or the counters could not be updated. |
| 405 | `{ "error": "method_not_allowed" }` | Any method other than `POST` or `OPTIONS`. |

`OPTIONS` answers 200 with CORS headers for the browser.

`CandidateRecord` is the type in `src/domain/types.ts`. The function keeps its own copy in `supabase/functions/read-document/schema.ts`; change both together.

## Order of checks

1. Signed-in user, else 401.
2. Body, else 400.
3. `GEMINI_API_KEY` present, else 503. Nothing is read or counted.
4. Document owned by the caller (service-role query filtered by `id` and `user_id`), else 404.
5. Image downloaded from the `documents` bucket, at most 10 MB (413) and an image type (415). Nothing is counted yet.
6. Counters: the account's `profiles.gemini_reads` must be below 5, then today's `usage_counters.gemini_reads` (UTC day) must be below `GEMINI_DAILY_CAP`. Each is raised by one. If the daily cap is reached after the account read was taken, the account read is given back. Either limit answers 429.
7. Gemini is called. Once the counters are raised, a Google failure still uses up the read: a failed call may have used Google's free quota.
8. The reply is validated (below) and returned.

## Counters cannot be raced past a limit

No SQL function or migration is added. The function uses the service-role client and a compare-and-set update:

```sql
update profiles set gemini_reads = n + 1 where id = <user> and gemini_reads = n returning id
```

where `n` is the value just read and is below the limit. If another request changed the row first, no row comes back and the function reads again (up to 8 times, then 503). Every successful update moves a counter by exactly one from a value below its limit, so concurrent requests cannot take it past the limit. `usage_counters` works the same way; the day's row is first created with `insert ... on conflict (day) do nothing`.

## Validation of the reply

The prompt (`prompt.ts`) asks for `{"candidates": [...]}` in the `CandidateRecord` shape, text copied exactly as written, `null` for anything unreadable, JSON only. Gemini is called with `responseMimeType: application/json` and temperature 0.

Every candidate is checked (`schema.ts`):

- Dropped: an unknown `type`, a `details.kind` that does not equal `type`, a missing or empty `title`, a lab result record with no result that has both a name and a value.
- Set to `null`: a text field that is not a string or is over its length limit; a date that is not a real `YYYY-MM-DD` date; a `severity` other than `mild`, `moderate`, `severe`.
- Lab result rows without a name or value are dropped.
- Extra keys are removed. Text is trimmed at the ends and otherwise left as returned. Nothing is converted: a number where text belongs becomes `null`.
- At most 20 candidates are kept.

## Client

`src/data/readWithGoogle.ts`:

```ts
readWithGoogle(documentId: string): Promise<{ ok: true; candidates: CandidateRecord[] } | { ok: false; reason: 'limit' | 'unavailable' }>
```

429 maps to `limit`. Every other failure, including a network error or a reply without a `candidates` array, maps to `unavailable`.

`ScanConfirm` shows the consent text every time `Read with Google AI` is pressed. Only `Send to Google AI` uploads the page (`uploadDocument`, once) and calls `readWithGoogle` with the new document id. Records saved from the returned candidates are linked to that same document. `limit`, `unavailable` or an upload failure open the manual form with `Google AI is not available right now. You can type the details in.`

## Environment (Edge Function secrets)

| Name | Required | Default | Meaning |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | none | A Google AI Studio key from a project with no billing account. Missing: every call answers 503. |
| `GEMINI_MODEL` | No | `gemini-3.5-flash-lite` | The Gemini model code. |
| `GEMINI_DAILY_CAP` | No | `100` | App-wide reads per UTC day. Must be a positive integer, else the default is used. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Provided by Supabase | | Service-role client for the document lookup, storage download and counters. |

## Google free tier, checked 16 Nov 2026

- Models page (`https://aistudio.google.com/docs/models`, formerly `ai.google.dev/gemini-api/docs/models`): `gemini-3.5-flash-lite` is listed as stable. `gemini-3.1-flash-lite` is also stable. `gemini-2.5-flash` is deprecated and is routed to `gemini-3.5-flash-lite` from 1 Dec 2026. `gemini-2.0-flash` and `gemini-2.0-flash-lite` are shut down. Google recommends 3.5 Flash-Lite for new projects.
- Pricing page (`https://aistudio.google.com/docs/pricing`): 3.5 Flash-Lite, 3.1 Flash-Lite and 2.5 Flash-Lite are free of charge on the free tier, and free-tier content is used to improve Google's products. This is why the consent text says so.
- Rate limits page (`https://aistudio.google.com/docs/rate-limits`): Google no longer publishes per-model free-tier numbers; it says limits vary by model and shows the live ones per project in AI Studio (`https://aistudio.google.com/rate-limit`). Third-party trackers in November 2026 most often give about 10 requests per minute and 500 requests per day for Flash-Lite on the free tier. Limits are per Google Cloud project, not per key.
- Chosen: `GEMINI_MODEL` default `gemini-3.5-flash-lite`; `GEMINI_DAILY_CAP` default 100, a fifth of the most-cited 500 per day, leaving room if Google lowers it. Before going live, read the project's real limit in AI Studio and set the cap below it.
- The key must come from a project with no billing account. With billing enabled the same calls would be charged.
