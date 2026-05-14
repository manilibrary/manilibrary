-- Run once in Supabase SQL Editor on an existing DB created from an older
-- `new-database-schema-rls-encryption.sql` revision so deleting `auth.users`
-- (or `public.profiles`) does not fail on child FKs.
--
-- After this, `auth.admin.deleteUser` / CASCADE from profiles still benefits from
-- the app’s explicit superadmin purge, but direct DB deletes are safer too.

alter table public.attendance_days
  drop constraint if exists attendance_days_processed_by_user_id_fkey;
alter table public.attendance_days
  add constraint attendance_days_processed_by_user_id_fkey
    foreign key (processed_by_user_id) references auth.users (id) on delete set null;

alter table public.attendance_days
  drop constraint if exists attendance_days_processed_by_device_user_id_fkey;
alter table public.attendance_days
  add constraint attendance_days_processed_by_device_user_id_fkey
    foreign key (processed_by_device_user_id) references public.profiles (device_user_id)
    on update cascade on delete set null;

alter table public.library_export_audit
  drop constraint if exists library_export_audit_device_user_id_fkey;
alter table public.library_export_audit
  add constraint library_export_audit_device_user_id_fkey
    foreign key (device_user_id) references public.profiles (device_user_id)
    on update cascade on delete cascade;

alter table public.etime_attendance_daily
  drop constraint if exists etime_attendance_daily_device_user_id_fkey;
alter table public.etime_attendance_daily
  add constraint etime_attendance_daily_device_user_id_fkey
    foreign key (device_user_id) references public.profiles (device_user_id)
    on update cascade on delete cascade;

alter table public.etime_punch_raw
  drop constraint if exists etime_punch_raw_device_user_id_fkey;
alter table public.etime_punch_raw
  add constraint etime_punch_raw_device_user_id_fkey
    foreign key (device_user_id) references public.profiles (device_user_id)
    on update cascade on delete cascade;

-- etime_empcode_map: ensure ON DELETE CASCADE (idempotent).
alter table public.etime_empcode_map
  drop constraint if exists etime_empcode_map_device_user_id_fkey;
alter table public.etime_empcode_map
  add constraint etime_empcode_map_device_user_id_fkey
    foreign key (device_user_id) references public.profiles (device_user_id)
    on update cascade on delete cascade;
