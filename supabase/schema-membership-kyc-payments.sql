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
