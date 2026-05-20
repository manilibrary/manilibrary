-- Fix: role-flag updates failed from SQL Editor / Table Editor with "only a superadmin…".
-- Supabase often sets auth.uid() to your *dashboard* login even when "Run as postgres",
-- so auth.uid() is not null and the superadmin check fails.
-- Use session_user (unchanged inside SECURITY DEFINER) to detect a real DB-owner session.
-- Also allow auth.uid() is null (e.g. some service paths).

create or replace function public.profiles_prevent_role_self_promotion()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
declare
  caller_is_superadmin boolean;
  role_change boolean := (new.is_admin is distinct from old.is_admin)
    or (new.is_superadmin is distinct from old.is_superadmin);
  sess text := lower(session_user::text);
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if not role_change then
    return new;
  end if;

  -- Primary Database + role postgres in SQL Editor / psql as superuser.
  if sess in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if new.user_id = auth.uid() then
    raise exception 'cannot change your own role flags — ask another superadmin';
  end if;

  select p.is_superadmin into caller_is_superadmin
  from public.profiles p where p.user_id = auth.uid() and p.deleted_at is null;
  if not coalesce(caller_is_superadmin, false) then
    raise exception 'only a superadmin can change role flags';
  end if;
  return new;
end;
$$;
