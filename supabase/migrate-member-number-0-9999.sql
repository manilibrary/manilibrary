-- =============================================================================
-- Migrate member_number from 1000–9999 only → any value 0–9999 (four-digit space).
-- Run once in Supabase SQL Editor on a project that already applied schema-profiles.sql.
-- =============================================================================

-- 1) Relax CHECK on profiles.member_number
alter table public.profiles drop constraint if exists profiles_member_number_check;

alter table public.profiles
  add constraint profiles_member_number_check
  check (member_number >= 0 and member_number <= 9999);

-- 2) Allow sequence to issue 0–9999 (keeps existing last_value unless data requires bumping)
alter sequence if exists public.member_number_seq minvalue 0 maxvalue 9999;

-- Next nextval() should be > max(member_number) when possible (caps at 9999; cannot auto-fix a full 0–9999 table)
do $$
declare
  mx  int;
  lv  int;
  nxt int;
begin
  select coalesce(max(member_number), -1) into mx from public.profiles;
  select last_value into lv from public.member_number_seq;
  nxt := mx + 1;
  if nxt > 9999 then
    raise notice 'All 0–9999 member numbers may be in use. Sequence last_value=%.', lv;
  else
    perform setval('public.member_number_seq', greatest(lv, nxt), true);
  end if;
end $$;

comment on column public.profiles.member_number is
  'Public / device id: integer 0–9999 (show as four digits). Immutable after insert.';
