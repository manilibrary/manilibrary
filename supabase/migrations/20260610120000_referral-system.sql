-- Referral credits: members earn credits when a referred user completes first paid membership.
-- 1 credit = ₹1. Redeemable at checkout (referrer only; referee gets no credits).

alter table public.library_settings
  add column if not exists referral_enabled boolean not null default true,
  add column if not exists referral_credits_per_referral bigint not null default 50
    check (referral_credits_per_referral >= 0),
  add column if not exists referral_max_per_member int not null default 5
    check (referral_max_per_member >= 0);

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists credit_balance bigint not null default 0
    check (credit_balance >= 0);

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code)
  where referral_code is not null and deleted_at is null;

create table if not exists public.member_referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_user_id   uuid not null references public.profiles (user_id) on delete cascade,
  referee_user_id    uuid not null unique references public.profiles (user_id) on delete cascade,
  referral_code_used text not null,
  status             text not null default 'pending_payment'
    check (status in ('pending_payment', 'credited', 'void')),
  credited_amount    bigint check (credited_amount is null or credited_amount >= 0),
  payment_id         uuid references public.payments (id) on delete set null,
  created_at         timestamptz not null default now(),
  credited_at        timestamptz,
  constraint member_referrals_no_self check (referrer_user_id <> referee_user_id)
);

create index if not exists member_referrals_referrer_idx
  on public.member_referrals (referrer_user_id, status);

create table if not exists public.member_credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (user_id) on delete cascade,
  kind          text not null check (kind in ('earn', 'redeem')),
  amount_rupees bigint not null check (amount_rupees > 0),
  balance_after bigint not null check (balance_after >= 0),
  referral_id   uuid references public.member_referrals (id) on delete set null,
  payment_id    uuid references public.payments (id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists member_credit_ledger_user_idx
  on public.member_credit_ledger (user_id, created_at desc);

-- Generate REF + 6 hex chars (e.g. REFA1B2C3).
create or replace function public.generate_member_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  tries int := 0;
begin
  loop
    tries := tries + 1;
    if tries > 50 then
      raise exception 'Could not generate unique referral code';
    end if;
    candidate := 'REF' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    exit when not exists (
      select 1 from public.profiles p where p.referral_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

-- Backfill referral codes for existing non-staff profiles.
update public.profiles
set referral_code = public.generate_member_referral_code()
where referral_code is null
  and deleted_at is null
  and is_admin = false
  and is_superadmin = false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_phone text;
  digits text;
  phone_val bigint;
  new_code text;
begin
  raw_phone := coalesce(new.raw_user_meta_data->>'phone', new.phone::text, '');
  digits := nullif(regexp_replace(trim(raw_phone), '\D', '', 'g'), '');
  phone_val := null;
  if digits is not null
    and digits !~ '@'
    and length(digits) between 7 and 15
    and digits ~ '^[0-9]+$'
  then
    phone_val := digits::bigint;
  end if;

  new_code := public.generate_member_referral_code();

  insert into public.profiles (user_id, full_name, phone, email, referral_code)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', 'Member'), 100),
    phone_val,
    left(coalesce(new.email::text, ''), 254),
    new_code
  );
  return new;
end;
$$;

alter table public.member_referrals enable row level security;
alter table public.member_credit_ledger enable row level security;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_library_admin'
  ) then
    drop policy if exists member_referrals_own_read on public.member_referrals;
    create policy member_referrals_own_read on public.member_referrals
      for select to authenticated
      using (referrer_user_id = auth.uid() or referee_user_id = auth.uid());

    drop policy if exists member_credit_ledger_own_read on public.member_credit_ledger;
    create policy member_credit_ledger_own_read on public.member_credit_ledger
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;
