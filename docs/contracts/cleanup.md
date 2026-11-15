# Contract: cleanup

Daily removal of old anonymous demo accounts. Owner: Task 20. Code: `supabase/functions/cleanup/`. Caller: `.github/workflows/daily.yml`.

## Endpoint

`POST /functions/v1/cleanup`, header `x-cleanup-secret: <CLEANUP_SECRET>`. No body. Deployed with `verify_jwt = false`; the secret is the only key. The workflow also sends `apikey: <publishable key>` for the Supabase gateway.

| Status | Body | When |
|---|---|---|
| 200 | `{ "deletedUsers": number }` | The run finished. The count is users actually deleted; users that failed are not counted and are retried next run. |
| 401 | `{ "error": "unauthorized" }` | Header missing or wrong, or `CLEANUP_SECRET` is unset or empty (then every request is refused). Compared in constant time. |
| 405 | `{ "error": "method_not_allowed" }` | Any method other than `POST`. No CORS, no `OPTIONS`. |
| 503 | `{ "error": "unavailable" }` | The auth user list or the profiles could not be read. Nobody was deleted. |

The response and the logs never contain a user id or email; the log has one line with counts.

## Who is deleted

A user is deleted only when all of these hold:

1. `is_anonymous` is exactly `true` on the auth user. Users with an email or any other sign-in are never touched.
2. The auth user's `created_at` is more than 7 days before now. An unreadable `created_at` means the user stays.
3. Their profile has `keep = false`, or they have no profile row. A user with no profile (never loaded the demo, or ran `delete_my_data()`) is deletable when 1 and 2 hold. Set `keep = true` by hand to protect an account.
4. The id is a uuid. Anything else is skipped, so the bucket root is never listed.

At most 200 users are attempted per call, read from up to 50 pages of 1000 auth users. The rest wait for the next run.

## Order for each user

1. List the `<user_id>/` folder of bucket `documents` through the Storage API, every page (100 entries each) and nested folders, before removing anything.
2. Remove the objects in batches of 100.
3. List again. If anything remains, or any step failed, the user is left in place.
4. Delete the auth user (`auth.admin.deleteUser`, hard delete). `profiles`, `records`, `documents`, `shares` and `reminder_dismissals` reference `auth.users(id) on delete cascade`; `share_access_log` cascades from `shares`.

A failure on one user does not stop the others.

## Secrets

Supabase Edge Function secret: `CLEANUP_SECRET` (a long random string). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase.

GitHub Actions secrets used by `daily.yml`:

| Secret | Value |
|---|---|
| `SUPABASE_FUNCTIONS_URL` | `https://waqlvbmsbgtqmcpeckzv.supabase.co/functions/v1` (no trailing slash) |
| `CLEANUP_SECRET` | The same value as the Supabase secret. |
| `SUPABASE_PUBLISHABLE_KEY` | The project's publishable key. |

## Schedule

Daily at 18:00 UTC (`0 18 * * *`), and by hand through `workflow_dispatch`. The daily call also keeps the free project from pausing. `curl -f` makes the job fail on any status other than 2xx.
