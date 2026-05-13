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
