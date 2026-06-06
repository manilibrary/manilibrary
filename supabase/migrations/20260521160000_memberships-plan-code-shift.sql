-- Wire memberships to library_plans + shift-based shared seating (floor 2).
-- Model:
--   * fixed_24h  -> plan_kind long_term  (floor 1, F seats, calendar months, 1 person/seat)
--   * morning/evening/night -> plan_kind short_term (floor 2, S seats, calendar months,
--       same physical seat sellable once PER SHIFT)
-- Additive + backward compatible: legacy long_term and legacy day/week short_term still valid.

create extension if not exists btree_gist;

alter table public.memberships
  add column if not exists plan_code text,
  add column if not exists shift text;

alter table public.memberships drop constraint if exists memberships_plan_code_len_check;
alter table public.memberships
  add constraint memberships_plan_code_len_check
    check (plan_code is null or char_length(plan_code) <= 64);

alter table public.memberships drop constraint if exists memberships_shift_check;
alter table public.memberships
  add constraint memberships_shift_check
    check (shift is null or shift in ('morning', 'evening', 'night'));

-- Allow short-term rows to use calendar-month windows (shift plans) OR legacy wall-clock windows.
alter table public.memberships drop constraint if exists memberships_short_term_window;
alter table public.memberships add constraint memberships_short_term_window check (
  plan_kind <> 'short_term'
  or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  or (valid_from is not null and valid_until is not null and valid_until >= valid_from)
);

-- Restrict the legacy time-window seat exclusion to rows that actually use starts_at/ends_at,
-- so new calendar-month shift rows (starts_at null) are not falsely treated as overlapping.
alter table public.memberships drop constraint if exists memberships_seat_no_overlap_short_term;
alter table public.memberships add constraint memberships_seat_no_overlap_short_term exclude using gist (
  seat_number with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (
  status = 'active' and plan_kind = 'short_term'
  and starts_at is not null and seat_number is not null and deleted_at is null
);

-- Shift seat exclusion: same seat may be sold once per shift; blocks same (seat, shift) over
-- overlapping calendar-month windows.
alter table public.memberships drop constraint if exists memberships_seat_no_overlap_shift;
alter table public.memberships add constraint memberships_seat_no_overlap_shift exclude using gist (
  seat_number with =,
  shift with =,
  daterange(valid_from, (valid_until + 1), '[)') with &&
) where (
  status = 'active' and plan_kind = 'short_term'
  and shift is not null and valid_from is not null and seat_number is not null and deleted_at is null
);
