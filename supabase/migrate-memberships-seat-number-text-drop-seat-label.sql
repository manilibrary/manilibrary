-- =============================================================================
-- Memberships: store seat as text F(n) / S(n) in seat_number; drop seat_label.
-- Run in Supabase → SQL Editor as postgres (backup first).
--
-- Rationale: seat_label duplicated display info; seat_number int could not
-- store the prefixed form. btree_gist exclusion still works with text =.
-- =============================================================================

begin;

alter table public.memberships
  drop constraint if exists memberships_seat_no_overlap_short_term;
alter table public.memberships
  drop constraint if exists memberships_seat_no_overlap_long_term;

drop index if exists public.memberships_seat_idx;

alter table public.memberships
  alter column seat_number type text using (
    case
      when seat_number is null then null
      when seat_label is not null and btrim(seat_label) <> '' then btrim(seat_label)
      when plan_kind = 'long_term' then 'F(' || seat_number::text || ')'
      when plan_kind = 'short_term' then 'S(' || seat_number::text || ')'
      else seat_number::text
    end
  );

alter table public.memberships
  drop column if exists seat_label;

create index if not exists memberships_seat_idx
  on public.memberships (seat_number)
  where seat_number is not null;

alter table public.memberships
  add constraint memberships_seat_no_overlap_short_term
  exclude using gist (
    seat_number with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'active' and plan_kind = 'short_term' and seat_number is not null);

alter table public.memberships
  add constraint memberships_seat_no_overlap_long_term
  exclude using gist (
    seat_number with =,
    daterange(valid_from, (valid_until + 1), '[)') with &&
  )
  where (status = 'active' and plan_kind = 'long_term' and seat_number is not null);

commit;
