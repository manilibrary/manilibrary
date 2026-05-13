-- =============================================================================
-- Legacy: widen profiles device_user_id (formerly member_number) to full 0–9999 range.
-- For fresh installs this is already covered by schema-profiles.sql + device_user_id_seq.
-- Run once only on older projects that had the pre-0–9999 check/sequence bounds.
-- =============================================================================

-- 1) Relax CHECK on profiles.device_user_id (handles legacy constraint names)
alter table public.profiles drop constraint if exists profiles_member_number_check;
alter table public.profiles drop constraint if exists profiles_device_user_id_check;

alter table public.profiles
  add constraint profiles_device_user_id_check
  check (device_user_id >= 0 and device_user_id <= 9999);

-- 2) Allow sequence to issue 0–9999 (keeps existing last_value unless data requires bumping)
alter sequence if exists public.device_user_id_seq minvalue 0 maxvalue 9999;

-- Next nextval() should be > max(device_user_id) when possible (caps at 9999; cannot auto-fix a full 0–9999 table)
do $$
declare
  mx  int;
  lv  int;
  nxt int;
begin
  select coalesce(max(device_user_id), -1) into mx from public.profiles;
  select last_value into lv from public.device_user_id_seq;
  nxt := mx + 1;
  if nxt > 9999 then
    raise notice 'All 0–9999 device user ids may be in use. Sequence last_value=%.', lv;
  else
    perform setval('public.device_user_id_seq', greatest(lv, nxt), true);
  end if;
end $$;

comment on column public.profiles.device_user_id is
  'Public / device id: integer 0–9999 (show as four digits). Immutable after insert.';
