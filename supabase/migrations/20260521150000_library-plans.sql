-- Sellable membership plans (admin/source of truth for homepage pricing).
-- Floor 2: shift plans (morning / evening / night). Floor 1: 24-hour fixed seat.
-- Each plan stores 1 / 3 / 6 month selling price + MRP (strikethrough).

create table if not exists public.library_plans (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique
    constraint library_plans_code_len_check check (char_length(code) <= 64),
  name        text not null
    constraint library_plans_name_len_check check (char_length(name) <= 120),
  floor       smallint not null check (floor in (1, 2)),
  access_label text not null
    constraint library_plans_access_label_len_check check (char_length(access_label) <= 160),
  is_24hour   boolean not null default false,
  price_1m    bigint not null check (price_1m >= 0),
  mrp_1m      bigint not null check (mrp_1m >= price_1m),
  price_3m    bigint not null check (price_3m >= 0),
  mrp_3m      bigint not null check (mrp_3m >= price_3m),
  price_6m    bigint not null check (price_6m >= 0),
  mrp_6m      bigint not null check (mrp_6m >= price_6m),
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists library_plans_active_sort_idx
  on public.library_plans (sort_order asc, created_at asc)
  where is_active;

-- MRP rule: mrp_3m = mrp_1m * 3, mrp_6m = mrp_1m * 6.
insert into public.library_plans
  (code, name, floor, access_label, is_24hour, price_1m, mrp_1m, price_3m, mrp_3m, price_6m, mrp_6m, sort_order)
values
  ('morning',   'Morning shift',        2, '6 AM – 2 PM',                  false,  699,  800, 1999,  2400, 3899,  4800, 10),
  ('evening',   'Evening shift',        2, '2 PM – 10 PM',                 false,  799,  900, 2199,  2700, 4099,  5400, 20),
  ('night',     'Night shift',          2, '10 PM – 6 AM',                 false,  499,  600, 1399,  1800, 2599,  3600, 30),
  ('fixed_24h', '24-hour fixed seat',   1, 'Reserved seat + 24-hour access', true, 1599, 1799, 4499,  5397, 8499, 10794, 40)
on conflict (code) do nothing;

-- Keep MRPs aligned to the 1-month MRP (×3, ×6) even if rows already existed.
update public.library_plans set mrp_3m = mrp_1m * 3, mrp_6m = mrp_1m * 6
  where mrp_3m <> mrp_1m * 3 or mrp_6m <> mrp_1m * 6;

alter table public.library_plans enable row level security;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_library_admin'
  ) then
    drop policy if exists library_plans_read on public.library_plans;
    create policy library_plans_read on public.library_plans
      for select to authenticated using (true);

    drop policy if exists library_plans_admin on public.library_plans;
    create policy library_plans_admin on public.library_plans
      for all to authenticated
      using (public.is_library_admin() or public.is_library_superadmin())
      with check (public.is_library_admin() or public.is_library_superadmin());
  end if;
end $$;
