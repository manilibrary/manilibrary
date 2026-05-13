-- =============================================================================
-- Rename profiles.member_number → device_user_id; rename dependent columns;
-- add device_user_id to memberships, payments, verification_requests,
-- verification_documents. Recreate eTime RLS policies and auth trigger helpers.
--
-- Run once in Supabase SQL Editor after backup.
--
-- Requires: public.profiles with column member_number (legacy), plus any of
-- memberships / payments / KYC tables you already use. eTime and archived
-- attendance tables are optional — steps are skipped if those relations were
-- never created (e.g. you never ran schema-etime-*.sql or attendance-day-archive.sql).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Drop eTime RLS policies (only if those tables exist; avoids 42P01)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.etime_attendance_daily') is not null then
    execute 'drop policy if exists etime_attendance_daily_select on public.etime_attendance_daily';
  end if;
  if to_regclass('public.etime_punch_raw') is not null then
    execute 'drop policy if exists etime_punch_raw_select on public.etime_punch_raw';
  end if;
  if to_regclass('public.etime_empcode_map') is not null then
    execute 'drop policy if exists etime_empcode_map_select on public.etime_empcode_map';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Sequence + profiles column
-- ---------------------------------------------------------------------------
alter sequence if exists public.member_number_seq rename to device_user_id_seq;

alter table public.profiles drop constraint if exists profiles_member_number_check;

alter table public.profiles rename column member_number to device_user_id;

alter table public.profiles
  add constraint profiles_device_user_id_check
  check (device_user_id >= 0 and device_user_id <= 9999);

alter sequence if exists public.device_user_id_seq minvalue 0 maxvalue 9999;

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
  'Public / device user id: integer 0–9999 (show as four digits). Immutable after insert.';

alter index if exists profiles_member_number_idx rename to profiles_device_user_id_idx;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_member_number_key'
  ) then
    alter table public.profiles rename constraint profiles_member_number_key to profiles_device_user_id_key;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Auth signup + immutability trigger
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, phone, email, device_user_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Member'),
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    new.email,
    nextval('public.device_user_id_seq')
  );
  return new;
end;
$$;

drop trigger if exists trg_profiles_lock_member_number on public.profiles;
drop function if exists public.profiles_lock_member_number();

create or replace function public.profiles_lock_device_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.device_user_id is distinct from old.device_user_id then
    raise exception 'device_user_id is immutable (user_id=%)', old.user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_lock_device_user_id on public.profiles;
create trigger trg_profiles_lock_device_user_id
  before update on public.profiles
  for each row execute function public.profiles_lock_device_user_id();

-- ---------------------------------------------------------------------------
-- 4) eTime + empcode map + attendance history (skip missing relations)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.etime_empcode_map') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'etime_empcode_map' and column_name = 'member_number'
    ) then
      execute 'alter table public.etime_empcode_map rename column member_number to device_user_id';
    end if;
  end if;
end $$;

alter index if exists etime_empcode_map_member_number_idx rename to etime_empcode_map_device_user_id_idx;

do $$
begin
  if to_regclass('public.etime_attendance_daily') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'etime_attendance_daily' and column_name = 'member_number'
    ) then
      execute 'alter table public.etime_attendance_daily rename column member_number to device_user_id';
    end if;
  end if;
  if to_regclass('public.etime_punch_raw') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'etime_punch_raw' and column_name = 'member_number'
    ) then
      execute 'alter table public.etime_punch_raw rename column member_number to device_user_id';
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.attendance_history_entries') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'attendance_history_entries' and column_name = 'member_number'
    ) then
      execute 'alter table public.attendance_history_entries rename column member_number to device_user_id';
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.attendance_history_entries') is not null then
    execute 'drop index if exists public.attendance_history_entries_member_idx';
    execute
      'create index if not exists attendance_history_entries_device_user_idx on public.attendance_history_entries (device_user_id)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Denormalized device_user_id on membership / payment / KYC tables
-- ---------------------------------------------------------------------------
alter table public.memberships add column if not exists device_user_id int;
update public.memberships m
set device_user_id = p.device_user_id
from public.profiles p
where p.user_id = m.user_id and m.device_user_id is null;

alter table public.memberships alter column device_user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'memberships_device_user_id_fkey'
  ) then
    alter table public.memberships
      add constraint memberships_device_user_id_fkey
      foreign key (device_user_id) references public.profiles (device_user_id) on update cascade;
  end if;
end $$;

create index if not exists memberships_device_user_id_idx on public.memberships (device_user_id);

alter table public.payments add column if not exists device_user_id int;
update public.payments py
set device_user_id = p.device_user_id
from public.profiles p
where p.user_id = py.user_id and py.device_user_id is null;

alter table public.payments alter column device_user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_device_user_id_fkey'
  ) then
    alter table public.payments
      add constraint payments_device_user_id_fkey
      foreign key (device_user_id) references public.profiles (device_user_id) on update cascade;
  end if;
end $$;

create index if not exists payments_device_user_id_idx on public.payments (device_user_id);

alter table public.verification_requests add column if not exists device_user_id int;
update public.verification_requests vr
set device_user_id = p.device_user_id
from public.profiles p
where p.user_id = vr.user_id and vr.device_user_id is null;

alter table public.verification_requests alter column device_user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'verification_requests_device_user_id_fkey'
  ) then
    alter table public.verification_requests
      add constraint verification_requests_device_user_id_fkey
      foreign key (device_user_id) references public.profiles (device_user_id) on update cascade;
  end if;
end $$;

create index if not exists verification_requests_device_user_id_idx
  on public.verification_requests (device_user_id);

alter table public.verification_documents add column if not exists device_user_id int;
update public.verification_documents vd
set device_user_id = p.device_user_id
from public.verification_requests vr
join public.profiles p on p.user_id = vr.user_id
where vd.verification_id = vr.id and vd.device_user_id is null;

alter table public.verification_documents alter column device_user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'verification_documents_device_user_id_fkey'
  ) then
    alter table public.verification_documents
      add constraint verification_documents_device_user_id_fkey
      foreign key (device_user_id) references public.profiles (device_user_id) on update cascade;
  end if;
end $$;

create index if not exists verification_documents_device_user_id_idx
  on public.verification_documents (device_user_id);

-- ---------------------------------------------------------------------------
-- 6) Keep denormalized device_user_id in sync (app may omit on insert)
-- ---------------------------------------------------------------------------
create or replace function public.memberships_sync_device_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  select p.device_user_id into strict new.device_user_id
  from public.profiles p
  where p.user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_memberships_sync_device_user_id on public.memberships;
create trigger trg_memberships_sync_device_user_id
  before insert or update of user_id on public.memberships
  for each row execute function public.memberships_sync_device_user_id();

create or replace function public.payments_sync_device_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  select p.device_user_id into strict new.device_user_id
  from public.profiles p
  where p.user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_payments_sync_device_user_id on public.payments;
create trigger trg_payments_sync_device_user_id
  before insert or update of user_id on public.payments
  for each row execute function public.payments_sync_device_user_id();

create or replace function public.verification_requests_sync_device_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  select p.device_user_id into strict new.device_user_id
  from public.profiles p
  where p.user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_verification_requests_sync_device_user_id on public.verification_requests;
create trigger trg_verification_requests_sync_device_user_id
  before insert or update of user_id on public.verification_requests
  for each row execute function public.verification_requests_sync_device_user_id();

create or replace function public.verification_documents_sync_device_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  select p.device_user_id into strict new.device_user_id
  from public.verification_requests vr
  join public.profiles p on p.user_id = vr.user_id
  where vr.id = new.verification_id;
  return new;
end;
$$;

drop trigger if exists trg_verification_documents_sync_device_user_id on public.verification_documents;
create trigger trg_verification_documents_sync_device_user_id
  before insert or update of verification_id on public.verification_documents
  for each row execute function public.verification_documents_sync_device_user_id();

-- ---------------------------------------------------------------------------
-- 7) RLS (eTime tables): recreate policies only when tables exist
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.etime_attendance_daily') is not null then
    execute 'drop policy if exists etime_attendance_daily_select on public.etime_attendance_daily';
    execute $pol$
      create policy etime_attendance_daily_select on public.etime_attendance_daily
        for select to authenticated
        using (
          device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
          or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
        )
    $pol$;
  end if;
  if to_regclass('public.etime_punch_raw') is not null then
    execute 'drop policy if exists etime_punch_raw_select on public.etime_punch_raw';
    execute $pol$
      create policy etime_punch_raw_select on public.etime_punch_raw
        for select to authenticated
        using (
          device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
          or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
        )
    $pol$;
  end if;
  if to_regclass('public.etime_empcode_map') is not null then
    execute 'drop policy if exists etime_empcode_map_select on public.etime_empcode_map';
    execute $pol$
      create policy etime_empcode_map_select on public.etime_empcode_map
        for select to authenticated
        using (
          device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
          or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
        )
    $pol$;
  end if;
end $$;

commit;
