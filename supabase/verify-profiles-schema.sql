-- Run in Supabase → SQL Editor to confirm the profiles setup exists.
-- (Does not change data.)

-- Table present?
select to_regclass('public.profiles') as profiles_table;

-- Columns the manilibrary app uses (must all exist)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'user_id',
    'member_number',
    'full_name',
    'phone',
    'email',
    'is_admin',
    'created_at',
    'updated_at'
  )
order by column_name;

-- Sequence for member numbers (assigned in handle_new_user via nextval)
select exists(
  select 1 from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S' and c.relname = 'member_number_seq'
) as member_number_seq_exists;

-- Trigger on auth.users → new profile rows
select tgname, tgrelid::regclass as on_table
from pg_trigger
where not tgisinternal
  and tgname = 'on_auth_user_created';

-- Lock trigger on profiles
select tgname, tgrelid::regclass as on_table
from pg_trigger
where not tgisinternal
  and tgname = 'trg_profiles_lock_member_number';
