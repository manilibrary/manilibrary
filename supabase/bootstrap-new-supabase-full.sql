-- =============================================================================
-- MANI LIBRARY — bootstrap-new-supabase-full.sql
-- =============================================================================
-- Run ONCE in a NEW empty Supabase project: Dashboard → SQL → New query → paste
-- this entire file → Run.
--
-- What this does (matches repo order):
--   profiles + auth trigger, memberships/KYC/payments + RLS, profile intake,
--   superadmin flag, library export audit, Storage buckets (kyc-private, avatars).
--   Optional eTime + attendance tables at the bottom: they are inside a /* … */
--   block. To create those tables too, delete the line containing only /*
--   (before schema-etime-punch) and delete the line containing only */ (right
--   before the FOOTER section), then run again — or run the three optional .sql
--   files separately from this folder.
--
-- NOT included (legacy / one-off — do not run on fresh DB):
--   migrate-*.sql, fix-stale-profiles-*, diagnose-*, backfill-*, enforce-seat-*
--   (duplicate), add-memberships-seat-label.sql, set-admin.sql / set-superadmin.sql
--   (run AFTER a user exists — see footer).
--
-- After this script:
--   1) Authentication → URL configuration: Site URL + Redirect URLs for your app.
--   2) Vercel/hosting: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
--      SUPABASE_SERVICE_ROLE_KEY (+ Razorpay, bucket env vars if renamed).
--   3) Sign up once, then run set-admin.sql (staff) and/or set-superadmin.sql
--      (library superadmin /dashboard/superadmin); edit the email inside each file.
-- =============================================================================


-- ========== schema-profiles.sql ==========

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

-- ========== schema-membership-kyc-payments.sql ==========

-- =============================================================================
-- Mani Library — memberships, payments, KYC (Aadhaar + student ID), verification
-- Run in Supabase → SQL Editor after public.profiles exists (schema-profiles.sql).
--
-- Before first use:
--   1) Create a PRIVATE Storage bucket, e.g. "kyc-private", and restrict access (RLS on storage.objects).
--   2) Optional: grandfather existing profiles as already verified:
--        UPDATE public.profiles SET verification_status = 'approved',
--               verification_reviewed_at = now() WHERE verification_status = 'none';
--   3) If `public.payments` already exists with column amount_minor (paise), run once:
--        supabase/migrate-payments-amount-minor-to-rupees.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Helper: admin check for RLS
-- ---------------------------------------------------------------------------
-- Must not re-enter RLS on public.profiles while evaluating policies that call
-- this helper (otherwise: payments → is_library_admin → profiles → … → stack depth).
create or replace function public.is_library_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_library_admin() from public;
grant execute on function public.is_library_admin() to authenticated;
grant execute on function public.is_library_admin() to service_role;

-- ---------------------------------------------------------------------------
-- 1) Extend public.profiles (verification banner in app)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists verification_status text not null default 'none'
    check (verification_status in ('none', 'pending', 'approved', 'rejected', 'resubmit'));

alter table public.profiles
  add column if not exists verification_submitted_at timestamptz;

alter table public.profiles
  add column if not exists verification_reviewed_at timestamptz;

comment on column public.profiles.verification_status is
  'none=new; pending=submitted docs; approved=rejected|resubmit need library contact or re-upload per product rules';

-- ---------------------------------------------------------------------------
-- 2) Verification submissions (admin workflow)
-- ---------------------------------------------------------------------------
create table if not exists public.verification_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  device_user_id     int not null references public.profiles (device_user_id) on update cascade,
  status             text not null default 'pending'
                       check (status in ('pending', 'approved', 'rejected', 'resubmit')),
  submitted_at       timestamptz not null default now(),
  reviewed_at        timestamptz,
  reviewed_by        uuid references auth.users (id),
  admin_internal_note text,
  student_message    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists verification_requests_one_pending_per_user
  on public.verification_requests (user_id)
  where status = 'pending';

create index if not exists verification_requests_user_idx
  on public.verification_requests (user_id);

create index if not exists verification_requests_status_idx
  on public.verification_requests (status);

create index if not exists verification_requests_device_user_id_idx
  on public.verification_requests (device_user_id);

-- ---------------------------------------------------------------------------
-- 3) Uploaded files (paths into Storage — do not store Aadhaar number in DB)
-- ---------------------------------------------------------------------------
create table if not exists public.verification_documents (
  id                 uuid primary key default gen_random_uuid(),
  verification_id    uuid not null references public.verification_requests (id) on delete cascade,
  device_user_id     int not null references public.profiles (device_user_id) on update cascade,
  doc_type           text not null
                       check (doc_type in ('aadhaar_front', 'aadhaar_back', 'student_id')),
  storage_bucket     text not null default 'kyc-private',
  storage_path       text not null,
  content_type       text,
  uploaded_at        timestamptz not null default now(),
  unique (verification_id, doc_type)
);

create index if not exists verification_documents_verification_idx
  on public.verification_documents (verification_id);

create index if not exists verification_documents_device_user_id_idx
  on public.verification_documents (device_user_id);

-- ---------------------------------------------------------------------------
-- 3b) Checkout-only KYC staging (promoted after membership payment succeeds)
-- ---------------------------------------------------------------------------
create table if not exists public.kyc_checkout_pending_documents (
  user_id          uuid not null references auth.users (id) on delete cascade,
  doc_type         text not null
                     check (doc_type in ('aadhaar_front', 'aadhaar_back', 'student_id')),
  storage_bucket   text not null default 'kyc-private',
  storage_path     text not null,
  content_type     text not null,
  updated_at       timestamptz not null default now(),
  primary key (user_id, doc_type)
);

create index if not exists kyc_checkout_pending_documents_updated_idx
  on public.kyc_checkout_pending_documents (updated_at);

-- ---------------------------------------------------------------------------
-- 4) Memberships (short-term = wall clock; long-term = calendar window)
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  device_user_id  int not null references public.profiles (device_user_id) on update cascade,
  plan_kind       text not null check (plan_kind in ('short_term', 'long_term')),
  status          text not null default 'pending_payment'
                    check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  seat_number     text, -- active: F(n)/S(n). pending_payment: literal 'Not applicable'; planned token in payments.metadata.planned_seat_token until paid
  starts_at       timestamptz,
  ends_at         timestamptz,
  valid_from      date,
  valid_until     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint memberships_short_term_window check (
    plan_kind <> 'short_term'
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  ),
  constraint memberships_long_term_window check (
    plan_kind <> 'long_term'
    or (valid_from is not null and valid_until is not null and valid_until >= valid_from)
  )
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_device_user_id_idx on public.memberships (device_user_id);
create index if not exists memberships_status_idx on public.memberships (status);
create index if not exists memberships_seat_idx on public.memberships (seat_number)
  where seat_number is not null;

-- ---------------------------------------------------------------------------
-- 4b) Seat exclusivity: prevent double-booking active seats (overlapping windows)
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist;

-- Short-term: seat cannot overlap on wall-clock time.
alter table public.memberships
  drop constraint if exists memberships_seat_no_overlap_short_term;
alter table public.memberships
  add constraint memberships_seat_no_overlap_short_term
  exclude using gist (
    seat_number with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'active' and plan_kind = 'short_term' and seat_number is not null);

-- Long-term: seat cannot overlap on calendar window (inclusive end date).
alter table public.memberships
  drop constraint if exists memberships_seat_no_overlap_long_term;
alter table public.memberships
  add constraint memberships_seat_no_overlap_long_term
  exclude using gist (
    seat_number with =,
    daterange(valid_from, (valid_until + 1), '[)') with &&
  )
  where (status = 'active' and plan_kind = 'long_term' and seat_number is not null);

-- ---------------------------------------------------------------------------
-- 5) Payments (link to user + optional membership after checkout)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  device_user_id        int not null references public.profiles (device_user_id) on update cascade,
  membership_id         uuid references public.memberships (id) on delete set null,
  amount_rupees         bigint not null check (amount_rupees >= 0),
  currency              text not null default 'INR',
  provider              text,
  provider_payment_id   text,
  status                text not null default 'pending'
                          check (status in ('pending', 'paid', 'failed', 'refunded')),
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.payments.amount_rupees is
  'INR amount in whole rupees (e.g. 500 = ₹500). Razorpay API still uses paise; the app converts ×100 when creating orders.';

create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_device_user_id_idx on public.payments (device_user_id);
create index if not exists payments_membership_idx on public.payments (membership_id);
create index if not exists payments_provider_id_idx on public.payments (provider, provider_payment_id);

-- FK from memberships → payments optional (avoid circular create order): add after both exist
alter table public.memberships
  add column if not exists payment_id uuid references public.payments (id) on delete set null;

create index if not exists memberships_payment_idx on public.memberships (payment_id);

-- ---------------------------------------------------------------------------
-- 6) updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_verification_requests_updated on public.verification_requests;
create trigger trg_verification_requests_updated
  before update on public.verification_requests
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_memberships_updated on public.memberships;
create trigger trg_memberships_updated
  before update on public.memberships
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated
  before update on public.payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 7) Sync profiles.verification_* from verification_requests
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_verification_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    update public.profiles
    set
      verification_status = 'pending',
      verification_submitted_at = coalesce(new.submitted_at, now()),
      updated_at = now()
    where user_id = new.user_id;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    update public.profiles
    set
      verification_status = case new.status
        when 'approved' then 'approved'
        when 'rejected' then 'rejected'
        when 'resubmit' then 'resubmit'
        when 'pending' then 'pending'
      end,
      verification_reviewed_at = case
        when new.status in ('approved', 'rejected', 'resubmit')
        then coalesce(new.reviewed_at, now())
        else verification_reviewed_at
      end,
      updated_at = now()
    where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_verification on public.verification_requests;
create trigger trg_sync_profile_verification
  after insert or update on public.verification_requests
  for each row execute function public.sync_profile_verification_from_request();

-- ---------------------------------------------------------------------------
-- 7b) Denormalized device_user_id: filled before insert if omitted (matches migration)
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
-- 8) Row Level Security
-- ---------------------------------------------------------------------------
alter table public.verification_requests enable row level security;
alter table public.verification_documents enable row level security;
alter table public.kyc_checkout_pending_documents enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;

-- verification_requests
drop policy if exists "vr_select_own_or_admin" on public.verification_requests;
create policy "vr_select_own_or_admin"
  on public.verification_requests for select
  using (user_id = auth.uid() or public.is_library_admin());

drop policy if exists "vr_insert_own_pending" on public.verification_requests;
create policy "vr_insert_own_pending"
  on public.verification_requests for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

drop policy if exists "vr_update_admin" on public.verification_requests;
create policy "vr_update_admin"
  on public.verification_requests for update
  using (public.is_library_admin())
  with check (public.is_library_admin());

-- verification_documents (via parent verification)
drop policy if exists "vd_select_own_or_admin" on public.verification_documents;
create policy "vd_select_own_or_admin"
  on public.verification_documents for select
  using (
    public.is_library_admin()
    or exists (
      select 1 from public.verification_requests vr
      where vr.id = verification_documents.verification_id
        and vr.user_id = auth.uid()
    )
  );

drop policy if exists "vd_insert_own" on public.verification_documents;
create policy "vd_insert_own"
  on public.verification_documents for insert
  with check (
    exists (
      select 1 from public.verification_requests vr
      where vr.id = verification_documents.verification_id
        and vr.user_id = auth.uid()
        and vr.status = 'pending'
    )
  );

drop policy if exists "vd_delete_own_pending" on public.verification_documents;
create policy "vd_delete_own_pending"
  on public.verification_documents for delete
  using (
    exists (
      select 1 from public.verification_requests vr
      where vr.id = verification_documents.verification_id
        and vr.user_id = auth.uid()
        and vr.status = 'pending'
    )
  );

-- memberships
drop policy if exists "mb_select_own_or_admin" on public.memberships;
create policy "mb_select_own_or_admin"
  on public.memberships for select
  using (user_id = auth.uid() or public.is_library_admin());

drop policy if exists "mb_insert_own" on public.memberships;
create policy "mb_insert_own"
  on public.memberships for insert
  with check (user_id = auth.uid());

drop policy if exists "mb_update_own_or_admin" on public.memberships;
create policy "mb_update_own_or_admin"
  on public.memberships for update
  using (user_id = auth.uid() or public.is_library_admin())
  with check (user_id = auth.uid() or public.is_library_admin());

-- payments
drop policy if exists "pay_select_own_or_admin" on public.payments;
create policy "pay_select_own_or_admin"
  on public.payments for select
  using (user_id = auth.uid() or public.is_library_admin());

drop policy if exists "pay_insert_own" on public.payments;
create policy "pay_insert_own"
  on public.payments for insert
  with check (user_id = auth.uid());

drop policy if exists "pay_update_own_or_admin" on public.payments;
create policy "pay_update_own_or_admin"
  on public.payments for update
  using (user_id = auth.uid() or public.is_library_admin())
  with check (user_id = auth.uid() or public.is_library_admin());

-- Service role bypasses RLS by default in Supabase.

-- ---------------------------------------------------------------------------
-- 9) Grants (RLS still applies for authenticated)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.verification_requests to authenticated;
grant select, insert, delete on public.verification_documents to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

grant all on public.verification_requests to service_role;
grant all on public.verification_documents to service_role;
grant all on public.kyc_checkout_pending_documents to service_role;
grant all on public.memberships to service_role;
grant all on public.payments to service_role;

-- ========== add-profile-intake-kyc.sql ==========

-- Profile intake (safe last-4 Aadhaar) + optional student meta. Run after schema-profiles.sql / schema-membership-kyc-payments.sql.
-- Full Aadhaar is never stored; only last 4 digits for desk cross-check.

alter table public.profiles
  add column if not exists aadhaar_last_four text,
  add column if not exists student_roll_number text,
  add column if not exists institution_type text
    check (institution_type is null or institution_type in ('school', 'college', 'freelance', 'other')),
  add column if not exists preparing_for text,
  add column if not exists verification_reviewed_by uuid references auth.users (id);

comment on column public.profiles.aadhaar_last_four is 'Last 4 digits of Aadhaar only (XXXX). Never store full number.';
comment on column public.profiles.institution_type is 'school | college | freelance | other';
comment on column public.profiles.verification_reviewed_by is 'Admin user who last set verification_status to approved/rejected.';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles' and c.conname = 'profiles_aadhaar_last_four_digits'
  ) then
    alter table public.profiles
      add constraint profiles_aadhaar_last_four_digits
      check (aadhaar_last_four is null or aadhaar_last_four ~ '^[0-9]{4}$');
  end if;
end $$;

-- ========== add-is-superadmin.sql ==========

-- One-time: grant a dedicated superadmin flag (separate from is_admin staff).
-- Run in Supabase SQL Editor after public.profiles exists.

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

comment on column public.profiles.is_superadmin is
  'When true, user may use /dashboard/superadmin and PATCH membership rows via API (service role).';

-- After a user exists, promote them with supabase/set-superadmin.sql (by email or UUID).

-- ========== fix-is-library-admin-rls-recursion.sql ==========

-- Fix: "stack depth limit exceeded" when selecting payments / profiles as admin.
-- Cause: RLS policies call public.is_library_admin(), which SELECTs public.profiles
-- under the same RLS rules → infinite recursion if profiles policies also use the helper.
--
-- Run once in Supabase → SQL Editor (safe to re-run).

create or replace function public.is_library_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_library_admin() from public;
grant execute on function public.is_library_admin() to authenticated;
grant execute on function public.is_library_admin() to service_role;

-- ========== library-export-audit.sql ==========

-- Audit trail for admin “library workbook” Excel exports (service role only).
-- Run in Supabase SQL Editor after auth.users exists.

create table if not exists public.library_export_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  from_ymd date not null,
  to_ymd date not null,
  directory_rows int not null default 0,
  membership_rows int not null default 0,
  payment_rows int not null default 0,
  attendance_rows int not null default 0,
  attendance_capped boolean not null default false,
  workbook_bytes bigint not null default 0
);

comment on table public.library_export_audit is
  'Who exported what date range and row counts; written by Next.js service role after generating the workbook.';

revoke all on public.library_export_audit from public;
revoke all on public.library_export_audit from anon;
revoke all on public.library_export_audit from authenticated;
grant select, insert, update, delete on public.library_export_audit to service_role;

-- ========== storage-kyc-bucket.sql ==========

-- Private bucket for KYC uploads (Aadhaar / student ID). Run once in Supabase → SQL Editor.
-- Uploads use the service role from Next.js; members do not need direct Storage read/write policies for upload to work.
-- After this, document uploads on /dashboard/me should succeed (or set KYC_STORAGE_BUCKET to match your bucket id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-private',
  'kyc-private',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do nothing;

-- ========== storage-avatars-bucket.sql ==========

-- Public bucket for member profile photos (safe visibility — library-facing portraits).
-- Uploads use the Next.js service role API (/api/me/avatar); members do not need Storage policies for uploads.
-- Run once in Supabase → SQL Editor. Override bucket id via AVATARS_STORAGE_BUCKET if needed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =============================================================================
-- OPTIONAL — eTime + attendance (uncomment the block below if you need these tables)
-- =============================================================================
/*
-- ========== schema-etime-punch.sql ==========

-- =============================================================================
-- Mani Library — eTimeOffice punch / attendance storage (device → Supabase)
-- Run after public.profiles exists (schema-profiles.sql).
--
-- Maps device Empcode to profiles.device_user_id (same integer; use leading
-- zeros on device only). If codes differ, use public.etime_empcode_map
-- (schema-etime-empcode-map.sql) before syncing.
--
-- Ingestion: use Supabase Edge Function / cron with service_role to INSERT;
-- authenticated users only SELECT (RLS below).
-- =============================================================================

create table if not exists public.etime_attendance_daily (
  id            bigserial primary key,
  device_user_id int not null references public.profiles (device_user_id) on update cascade,
  work_date     date not null,
  in_time       text,
  out_time      text,
  work_time     text,
  overtime      text,
  break_time    text,
  status        text,
  remark        text,
  late_in       text,
  erl_out       text,
  raw           jsonb not null,
  fetched_at    timestamptz not null default now(),
  unique (device_user_id, work_date)
);

create index if not exists etime_attendance_daily_work_date_idx
  on public.etime_attendance_daily (work_date desc);

create table if not exists public.etime_punch_raw (
  id            bigserial primary key,
  device_user_id int not null references public.profiles (device_user_id) on update cascade,
  punch_at      timestamptz not null,
  mcid          text not null default '',
  raw           jsonb not null,
  unique (device_user_id, punch_at, mcid)
);

create index if not exists etime_punch_raw_punch_at_idx
  on public.etime_punch_raw (punch_at desc);

alter table public.etime_attendance_daily enable row level security;
alter table public.etime_punch_raw enable row level security;

drop policy if exists etime_attendance_daily_select on public.etime_attendance_daily;
create policy etime_attendance_daily_select on public.etime_attendance_daily
  for select to authenticated
  using (
    device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
  );

drop policy if exists etime_punch_raw_select on public.etime_punch_raw;
create policy etime_punch_raw_select on public.etime_punch_raw
  for select to authenticated
  using (
    device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
  );

grant select on public.etime_attendance_daily to authenticated;
grant select on public.etime_punch_raw to authenticated;

comment on table public.etime_attendance_daily is 'Daily rollup from eTime DownloadInOutPunchData (B1); filled by server-side sync.';
comment on table public.etime_punch_raw is 'Raw punches from eTime DownloadPunchDataMCID (B2); filled by server-side sync.';

-- ========== schema-etime-empcode-map.sql ==========

-- =============================================================================
-- Map eTime device Empcode (e.g. "0002") → library profiles.device_user_id (0–9999).
-- Run once after public.profiles exists. Sync jobs resolve punches via this table
-- when the device code is not numerically equal to device_user_id.
-- =============================================================================

create table if not exists public.etime_empcode_map (
  empcode         text primary key,
  device_user_id  int not null references public.profiles (device_user_id) on update cascade on delete cascade,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists etime_empcode_map_device_user_id_idx
  on public.etime_empcode_map (device_user_id);

comment on table public.etime_empcode_map is
  'Device Empcode string from eTimeOffice → internal device_user_id; use when Empcode is zero-padded or differs from issued device_user_id.';

alter table public.etime_empcode_map enable row level security;

drop policy if exists etime_empcode_map_select on public.etime_empcode_map;
create policy etime_empcode_map_select on public.etime_empcode_map
  for select to authenticated
  using (
    device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
  );

grant select on public.etime_empcode_map to authenticated;

-- ========== attendance-day-archive.sql ==========

-- Snapshot of processed admin daily attendance (one row per library calendar day).
-- Run in Supabase SQL editor after other public tables exist.

create table if not exists public.attendance_day_snapshots (
  id uuid primary key default gen_random_uuid(),
  library_day_ymd date not null,
  device_from_dmy text not null,
  device_to_dmy text not null,
  source text not null,
  items jsonb not null,
  skipped_unregistered int not null default 0,
  archived_at timestamptz not null default now(),
  unique (library_day_ymd)
);

create index if not exists attendance_day_snapshots_day_idx
  on public.attendance_day_snapshots (library_day_ymd desc);

comment on table public.attendance_day_snapshots is
  'Frozen JSON snapshot from admin daily attendance processing for a library day; optional cron or manual POST.';

-- ---------------------------------------------------------------------------
-- Normalized rows for reporting / filters (one row per member per archived day).
-- Populated together with attendance_day_snapshots by archive POST / cron.
-- ---------------------------------------------------------------------------

create table if not exists public.attendance_history_entries (
  id bigint generated always as identity primary key,
  library_day_ymd date not null,
  date_dmy text not null,
  device_user_id int not null,
  empcode text not null,
  full_name text,
  seat_label text not null default '—',
  in_time text not null default '',
  out_time text not null default '',
  work_time text not null default '',
  status text not null default '',
  status_ui text not null default 'other',
  status_ui_label text not null default '—',
  remark text not null default '',
  source text not null,
  archived_at timestamptz not null default now()
);

create index if not exists attendance_history_entries_day_idx
  on public.attendance_history_entries (library_day_ymd desc);

create index if not exists attendance_history_entries_device_user_idx
  on public.attendance_history_entries (device_user_id);

comment on table public.attendance_history_entries is
  'Per-member daily attendance history copied when a day is archived (POST /api/admin/attendance/archive-day or cron).';
*/
-- =============================================================================
-- FOOTER — after your first Auth signup (profiles row exists)
-- =============================================================================
-- Staff admin (/dashboard and admin tools): edit email in set-admin.sql and run it,
-- OR:
--
--   update public.profiles p
--   set is_admin = true
--   from auth.users u
--   where p.user_id = u.id
--     and lower(trim(u.email)) = lower(trim('you@example.com'));
--
-- Library superadmin (/dashboard/superadmin): edit email in set-superadmin.sql and
-- run it, OR:
--
--   update public.profiles p
--   set is_superadmin = true
--   from auth.users u
--   where p.user_id = u.id
--     and lower(trim(u.email)) = lower(trim('you@example.com'));
--
-- By UUID instead of email: see commented blocks inside set-admin.sql / set-superadmin.sql.
-- =============================================================================
