-- =============================================================================
-- Repair: refresh auth + sync functions for `device_user_id` (canonical column)
-- =============================================================================
-- Use after `profiles.member_number` was renamed to `device_user_id` but
-- Postgres still has old function bodies that reference `member_number`.
--
-- Symptom: "column profiles.member_number does not exist" while the table has
-- `device_user_id` only.
--
-- Safe to run multiple times. Does NOT rename columns (assume migrate already ran).
-- Drops optional analysis views that may still join on legacy names.
-- =============================================================================

begin;

alter sequence if exists public.member_number_seq rename to device_user_id_seq;

-- Optional views (see drop-analysis-views.sql)
drop view if exists public.memberships_with_member;
drop view if exists public.payments_with_member;
drop view if exists public.verification_requests_with_member;

-- Auth signup (must insert device_user_id)
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

-- Denormalized device_user_id on child tables
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

commit;
