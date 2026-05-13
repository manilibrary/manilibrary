-- =============================================================================
-- Diagnose stale references to the LEGACY column name `member_number`
-- =============================================================================
-- Your live column is `public.profiles.device_user_id`. Old functions/views/RLS
-- may still contain the string `member_number` in their definitions — that
-- breaks at runtime. The queries below search for that legacy identifier (the
-- ILIKE patterns must stay as `member_number`, not `device_user_id`).
--
-- Run sections in Supabase → SQL Editor (or one section at a time).
-- =============================================================================

-- 1) Functions (body text still compiled with old column name)
--    Exclude aggregates: pg_get_functiondef() errors on array_agg, etc. (SQLSTATE 42809).
select n.nspname as schema, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and coalesce(p.prokind, 'f') <> 'a'
  and pg_get_functiondef(p.oid) ilike '%member_number%'
order by 1, 2;

-- 2) Views
select table_schema, table_name
from information_schema.views
where table_schema = 'public'
  and view_definition ilike '%member_number%'
order by 1, 2;

-- 3) RLS policies (expression still references old column)
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ilike '%member_number%'
    or coalesce(with_check, '') ilike '%member_number%'
  )
order by tablename, policyname;

-- 4) Confirm profiles columns (canonical: device_user_id; no member_number column)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;
