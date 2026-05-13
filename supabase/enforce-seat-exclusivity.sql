-- =============================================================================
-- Enforce seat exclusivity (run once on existing DBs).
-- Prevents double-booking the same seat for overlapping *active* memberships.
--
-- Run in Supabase → SQL Editor as postgres.
-- =============================================================================

create extension if not exists btree_gist;

alter table public.memberships
  drop constraint if exists memberships_seat_no_overlap_short_term;
alter table public.memberships
  add constraint memberships_seat_no_overlap_short_term
  exclude using gist (
    seat_number with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'active' and plan_kind = 'short_term' and seat_number is not null);

alter table public.memberships
  drop constraint if exists memberships_seat_no_overlap_long_term;
alter table public.memberships
  add constraint memberships_seat_no_overlap_long_term
  exclude using gist (
    seat_number with =,
    daterange(valid_from, (valid_until + 1), '[)') with &&
  )
  where (status = 'active' and plan_kind = 'long_term' and seat_number is not null);

