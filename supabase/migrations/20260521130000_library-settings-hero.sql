-- library_settings (create if missing) + homepage hero columns.
-- Safe to run in Supabase SQL Editor even if earlier plan/shift migrations were skipped.

create table if not exists public.library_settings (
  id int primary key default 1 check (id = 1),
  library_timezone text not null default 'Asia/Kolkata'
    constraint library_settings_timezone_len_check check (char_length(library_timezone) <= 64),
  long_term_daily_hours smallint not null default 16
    check (long_term_daily_hours between 1 and 24),
  updated_at timestamptz not null default now()
);

insert into public.library_settings (id) values (1) on conflict (id) do nothing;

alter table public.library_settings
  add column if not exists hero_1_image_url text
    check (hero_1_image_url is null or char_length(hero_1_image_url) <= 2048),
  add column if not exists hero_1_tagline text
    check (hero_1_tagline is null or char_length(hero_1_tagline) <= 80),
  add column if not exists hero_1_tagline_sub text
    check (hero_1_tagline_sub is null or char_length(hero_1_tagline_sub) <= 120),
  add column if not exists hero_2_image_url text
    check (hero_2_image_url is null or char_length(hero_2_image_url) <= 2048),
  add column if not exists hero_2_tagline text
    check (hero_2_tagline is null or char_length(hero_2_tagline) <= 80),
  add column if not exists hero_2_tagline_sub text
    check (hero_2_tagline_sub is null or char_length(hero_2_tagline_sub) <= 120),
  add column if not exists hero_3_image_url text
    check (hero_3_image_url is null or char_length(hero_3_image_url) <= 2048),
  add column if not exists hero_3_tagline text
    check (hero_3_tagline is null or char_length(hero_3_tagline) <= 80),
  add column if not exists hero_3_tagline_sub text
    check (hero_3_tagline_sub is null or char_length(hero_3_tagline_sub) <= 120);

alter table public.library_settings enable row level security;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_library_admin'
  ) then
    drop policy if exists library_settings_read on public.library_settings;
    create policy library_settings_read on public.library_settings
      for select to authenticated using (true);

    drop policy if exists library_settings_admin on public.library_settings;
    create policy library_settings_admin on public.library_settings
      for all to authenticated
      using (public.is_library_admin() or public.is_library_superadmin())
      with check (public.is_library_admin() or public.is_library_superadmin());
  end if;
end $$;
