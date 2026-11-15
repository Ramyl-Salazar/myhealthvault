-- A share may stay open for at most 7 days (plus 5 minutes of slack for the phone clock).
-- Without this, a phone with a fast clock could keep a "15 minutes" link open for a day.
alter table public.shares
  add constraint shares_expires_within_week
  check (expires_at <= created_at + interval '7 days 5 minutes');
