-- One-time: grant a dedicated superadmin flag (separate from is_admin staff).
-- Run in Supabase SQL Editor after public.profiles exists.

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

comment on column public.profiles.is_superadmin is
  'When true, user may use /dashboard/superadmin and PATCH membership rows via API (service role).';

-- After a user exists, promote them with supabase/set-superadmin.sql (by email or UUID).
