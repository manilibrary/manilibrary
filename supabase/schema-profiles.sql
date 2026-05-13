-- Reference DDL (run once per project). Aligned with manilibrary profile reads:
--   is_admin, full_name, device_user_id (0–9999, four-digit device space), phone
--
-- If you already applied this in Supabase, use verify-profiles-schema.sql instead.

create extension if not exists pgcrypto;

create sequence if not exists public.device_user_id_seq
  as integer
  start with 1
  increment by 1
  minvalue 0
  maxvalue 9999
  no cycle;

create table if not exists public.profiles (
  user_id            uuid primary key references auth.users (id) on delete restrict,
  device_user_id     int  not null unique check (device_user_id >= 0 and device_user_id <= 9999),
  full_name          text not null,
  phone              text,
  email              text,
  avatar_url         text,
  device_enrolled_at timestamptz,
  enrolled_by        uuid references auth.users (id),
  is_admin           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists profiles_device_user_id_idx on public.profiles (device_user_id);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.profiles_lock_device_user_id()
returns trigger language plpgsql as $$
begin
  if new.device_user_id is distinct from old.device_user_id then
    raise exception 'device_user_id is immutable (user_id=%)', old.user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_lock_device_user_id on public.profiles;
drop trigger if exists trg_profiles_lock_member_number on public.profiles;
create trigger trg_profiles_lock_device_user_id
  before update on public.profiles
  for each row execute function public.profiles_lock_device_user_id();
