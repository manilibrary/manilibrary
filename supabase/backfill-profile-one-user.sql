-- If a user exists in auth.users but has no public.profiles row (e.g. created before the trigger),
-- run this in Supabase SQL Editor (adjust email).

insert into public.profiles (user_id, full_name, phone, email, device_user_id)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), 'Member'),
  nullif(trim(u.raw_user_meta_data->>'phone'), ''),
  u.email,
  nextval('public.device_user_id_seq')
from auth.users u
where lower(u.email) = lower('REPLACE_WITH_EMAIL@example.com')
  and not exists (select 1 from public.profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;
