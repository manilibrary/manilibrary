-- =============================================================================
-- FULL SCRIPT: grant staff admin (manilibrary checks public.profiles.is_admin)
-- =============================================================================
-- Where: Supabase Dashboard → SQL → New query → Run
-- Before: the user must exist in Authentication and have a row in public.profiles
--         (register on your site once, or insert profile via your trigger/schema).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Ensure column exists on public.profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) PROMOTE ONE USER TO ADMIN — pick ONE of the following blocks only.
-- ---------------------------------------------------------------------------

-- 2a) By email (replace the email literal with the real admin sign-in email)
update public.profiles as p
set is_admin = true
from auth.users as u
where p.user_id = u.id
  and lower(trim(u.email)) = lower(trim('REPLACE_WITH_ADMIN_EMAIL@example.com'));

-- 2b) By Supabase Auth user id (replace UUID; from Dashboard → Authentication → Users)
--     Comment out 2a above and uncomment this block if you prefer UUID:
--
-- update public.profiles
-- set is_admin = true
-- where user_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- ---------------------------------------------------------------------------
-- 3) VERIFY — list every profile marked admin
-- ---------------------------------------------------------------------------
select
  p.user_id,
  u.email,
  p.is_admin,
  p.device_user_id,
  p.full_name
from public.profiles as p
inner join auth.users as u on u.id = p.user_id
where p.is_admin is true
order by u.email;

-- ---------------------------------------------------------------------------
-- 4) OPTIONAL — remove admin from one user (by email)
-- ---------------------------------------------------------------------------
-- update public.profiles as p
-- set is_admin = false
-- from auth.users as u
-- where p.user_id = u.id
--   and lower(trim(u.email)) = lower(trim('someone@example.com'));
