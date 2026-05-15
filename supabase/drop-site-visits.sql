-- Remove anonymous site traffic analytics (table + helper RPC).
-- Run in Supabase SQL Editor after deploying app code without site_visits.

begin;

drop function if exists public.site_visit_overview_stats();
drop table if exists public.site_visits cascade;

commit;
