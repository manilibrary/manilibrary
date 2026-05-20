-- Mani Library — minimal tables only (run in Supabase SQL Editor)
-- Requires existing v2 schema (profiles, memberships, touch_updated_at).

-- 1) Library-wide settings (one row)
create table if not exists public.library_settings (
  id                    int primary key default 1 check (id = 1),
  library_timezone      text not null default 'Asia/Kolkata'
    constraint library_settings_timezone_len_check check (char_length(library_timezone) <= 64),
  long_term_daily_hours smallint not null default 16 check (long_term_daily_hours between 1 and 24),
  updated_at            timestamptz not null default now()
);

insert into public.library_settings (id) values (1) on conflict (id) do nothing;

-- 2) Short-term shifts (admin adds morning / evening / more)
create table if not exists public.library_shifts (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique
    constraint library_shifts_code_len_check check (char_length(code) <= 64),
  display_name  text not null
    constraint library_shifts_display_name_len_check check (char_length(display_name) <= 120),
  start_time    time not null,
  end_time      time not null check (end_time > start_time),
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_library_shifts_updated on public.library_shifts;
create trigger trg_library_shifts_updated
  before update on public.library_shifts
  for each row execute function public.touch_updated_at();

insert into public.library_shifts (code, display_name, start_time, end_time, sort_order)
values
  ('morning', 'Morning', '06:00', '14:00', 10),
  ('evening', 'Evening', '14:00', '22:00', 20)
on conflict (code) do nothing;

-- 3) Sellable plans (price + duration; short-term links a shift)
create table if not exists public.plan_catalog (
  id              uuid primary key default gen_random_uuid(),
  plan_kind       text not null check (plan_kind in ('short_term', 'long_term')),
  duration_key    text not null unique
    constraint plan_catalog_duration_key_len_check check (char_length(duration_key) <= 80),
  label           text not null
    constraint plan_catalog_label_len_check check (char_length(label) <= 200),
  shift_id        uuid references public.library_shifts (id),
  calendar_months int check (calendar_months is null or calendar_months > 0),
  duration_hours  int check (duration_hours is null or duration_hours > 0),
  price_rupees    bigint not null check (price_rupees >= 0),
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (
    (plan_kind = 'long_term' and shift_id is null and calendar_months is not null)
    or (plan_kind = 'short_term' and shift_id is not null and duration_hours is not null)
  )
);

drop trigger if exists trg_plan_catalog_updated on public.plan_catalog;
create trigger trg_plan_catalog_updated
  before update on public.plan_catalog
  for each row execute function public.touch_updated_at();

-- Long term (F floor in app)
insert into public.plan_catalog (plan_kind, duration_key, label, calendar_months, price_rupees, sort_order)
values
  ('long_term', 'lt_1m',  '1 month',  1,  1500, 100),
  ('long_term', 'lt_3m',  '3 months', 3,  4500, 110),
  ('long_term', 'lt_6m',  '6 months', 6,  9000, 120),
  ('long_term', 'lt_12m', '12 months', 12, 18000, 130)
on conflict (duration_key) do nothing;

-- Short term (S floor) — one row per shift
insert into public.plan_catalog (plan_kind, duration_key, label, shift_id, duration_hours, price_rupees, sort_order)
select
  'short_term',
  v.key || '_' || s.code,
  v.label || ' · ' || s.display_name,
  s.id,
  v.hours,
  v.price,
  v.ord + s.sort_order
from (values
  ('st_1d',     '1 day',     24,   100, 200),
  ('st_7d',     '7 days',   168,   100, 210),
  ('st_hub_1m', '1 month',  180,   800, 220),
  ('st_hub_3m', '3 months', 540,  2400, 230),
  ('st_hub_6m', '6 months', 1080, 4800, 240)
) as v(key, label, hours, price, ord)
cross join public.library_shifts s
on conflict (duration_key) do nothing;

-- 4) Feedback — one row per user, array of reviews in JSON
create table if not exists public.member_feedback (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  entries    jsonb not null default '[]'::jsonb
    check (jsonb_typeof(entries) = 'array'),
  constraint member_feedback_entries_size_check check (octet_length(entries::text) <= 262144),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_member_feedback_updated on public.member_feedback;
create trigger trg_member_feedback_updated
  before update on public.member_feedback
  for each row execute function public.touch_updated_at();

-- Link membership → plan (and shift for seat map)
alter table public.memberships
  add column if not exists plan_catalog_id uuid references public.plan_catalog (id),
  add column if not exists shift_id uuid references public.library_shifts (id);

-- ---------------------------------------------------------------------------
-- RLS (minimal)
-- ---------------------------------------------------------------------------
alter table public.library_settings enable row level security;
alter table public.library_shifts enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.member_feedback enable row level security;

drop policy if exists library_settings_read on public.library_settings;
create policy library_settings_read on public.library_settings for select to authenticated using (true);
drop policy if exists library_settings_admin on public.library_settings;
create policy library_settings_admin on public.library_settings for all to authenticated
  using (public.is_library_admin() or public.is_library_superadmin())
  with check (public.is_library_admin() or public.is_library_superadmin());

drop policy if exists library_shifts_read on public.library_shifts;
create policy library_shifts_read on public.library_shifts for select to authenticated using (true);
drop policy if exists library_shifts_admin on public.library_shifts;
create policy library_shifts_admin on public.library_shifts for all to authenticated
  using (public.is_library_admin() or public.is_library_superadmin())
  with check (public.is_library_admin() or public.is_library_superadmin());

drop policy if exists plan_catalog_read on public.plan_catalog;
create policy plan_catalog_read on public.plan_catalog for select to authenticated using (is_active = true or public.is_library_admin() or public.is_library_superadmin());
drop policy if exists plan_catalog_admin on public.plan_catalog;
create policy plan_catalog_admin on public.plan_catalog for all to authenticated
  using (public.is_library_admin() or public.is_library_superadmin())
  with check (public.is_library_admin() or public.is_library_superadmin());

drop policy if exists member_feedback_own on public.member_feedback;
create policy member_feedback_own on public.member_feedback for select using (user_id = auth.uid() or public.is_library_admin() or public.is_library_superadmin());
drop policy if exists member_feedback_insert on public.member_feedback;
create policy member_feedback_insert on public.member_feedback for insert with check (user_id = auth.uid());
drop policy if exists member_feedback_update on public.member_feedback;
create policy member_feedback_update on public.member_feedback for update
  using (user_id = auth.uid() or public.is_library_admin() or public.is_library_superadmin())
  with check (user_id = auth.uid() or public.is_library_admin() or public.is_library_superadmin());
