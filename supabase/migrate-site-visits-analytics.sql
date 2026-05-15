-- Site visit analytics: indexes + staff-only stats helper for admin overview.
-- Run in Supabase SQL editor after `library-schema-v2-organized.sql` (site_visits table).

create index if not exists site_visits_visited_at_idx on public.site_visits (visited_at desc);
create index if not exists site_visits_visitor_key_idx on public.site_visits (visitor_key);
create index if not exists site_visits_visitor_path_time_idx on public.site_visits (visitor_key, path, visited_at desc);
create index if not exists site_visits_visitor_time_idx on public.site_visits (visitor_key, visited_at desc);

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
