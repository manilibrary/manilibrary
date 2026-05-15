-- =============================================================================
-- Create `site_visits` for anonymous + signed-in website traffic
-- Run once in Supabase → SQL Editor → New query → Run
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS)
-- =============================================================================

-- 1) Table (one row = one counted page view per browser per 20 min window)
create table if not exists public.site_visits (
  id            bigserial primary key,
  visited_at    timestamptz not null default now(),
  visitor_key   text not null,
  path          text,
  referrer      text,
  user_id       uuid references auth.users (id) on delete set null,
  metadata      jsonb not null default '{}'::jsonb,
  constraint site_visits_visitor_key_len check (char_length(visitor_key) >= 8)
);

-- 2) RLS
alter table public.site_visits enable row level security;

drop policy if exists site_visits_insert_public on public.site_visits;
create policy site_visits_insert_public on public.site_visits
  for insert to anon, authenticated
  with check (
    char_length(visitor_key) >= 8
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists site_visits_select_staff on public.site_visits;
create policy site_visits_select_staff on public.site_visits
  for select to authenticated
  using (public.is_library_admin() or public.is_library_superadmin());

-- 3) Grants (website can insert; staff can read via policy above)
grant insert on public.site_visits to anon, authenticated;
grant select on public.site_visits to authenticated;

grant usage, select on sequence public.site_visits_id_seq to anon, authenticated;

-- 4) Indexes (faster admin counts)
create index if not exists site_visits_visited_at_idx on public.site_visits (visited_at desc);
create index if not exists site_visits_visitor_key_idx on public.site_visits (visitor_key);
create index if not exists site_visits_visitor_path_time_idx on public.site_visits (visitor_key, path, visited_at desc);
create index if not exists site_visits_visitor_time_idx on public.site_visits (visitor_key, visited_at desc);

-- 5) Optional: fast stats for admin overview (service role / API)
create or replace function public.site_visit_overview_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'uniqueAllTime', (select count(distinct visitor_key)::bigint from public.site_visits),
    'uniqueToday', (
      select count(distinct visitor_key)::bigint
      from public.site_visits
      where visited_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    ),
    'unique30d', (
      select count(distinct visitor_key)::bigint
      from public.site_visits
      where visited_at >= (now() - interval '30 days')
    ),
    'pageViewsToday', (
      select count(*)::bigint
      from public.site_visits
      where visited_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    ),
    'pageViews30d', (
      select count(*)::bigint
      from public.site_visits
      where visited_at >= (now() - interval '30 days')
    )
  );
$$;

revoke all on function public.site_visit_overview_stats() from public;
grant execute on function public.site_visit_overview_stats() to service_role;
