-- =============================================================================
-- Mani Library — eTimeOffice punch / attendance storage (device → Supabase)
-- Run after public.profiles exists (schema-profiles.sql).
--
-- Maps device Empcode to profiles.device_user_id (same integer; use leading
-- zeros on device only). If codes differ, use public.etime_empcode_map
-- (schema-etime-empcode-map.sql) before syncing.
--
-- Ingestion: use Supabase Edge Function / cron with service_role to INSERT;
-- authenticated users only SELECT (RLS below).
-- =============================================================================

create table if not exists public.etime_attendance_daily (
  id            bigserial primary key,
  device_user_id int not null references public.profiles (device_user_id) on update cascade,
  work_date     date not null,
  in_time       text,
  out_time      text,
  work_time     text,
  overtime      text,
  break_time    text,
  status        text,
  remark        text,
  late_in       text,
  erl_out       text,
  raw           jsonb not null,
  fetched_at    timestamptz not null default now(),
  unique (device_user_id, work_date)
);

create index if not exists etime_attendance_daily_work_date_idx
  on public.etime_attendance_daily (work_date desc);

create table if not exists public.etime_punch_raw (
  id            bigserial primary key,
  device_user_id int not null references public.profiles (device_user_id) on update cascade,
  punch_at      timestamptz not null,
  mcid          text not null default '',
  raw           jsonb not null,
  unique (device_user_id, punch_at, mcid)
);

create index if not exists etime_punch_raw_punch_at_idx
  on public.etime_punch_raw (punch_at desc);

alter table public.etime_attendance_daily enable row level security;
alter table public.etime_punch_raw enable row level security;

drop policy if exists etime_attendance_daily_select on public.etime_attendance_daily;
create policy etime_attendance_daily_select on public.etime_attendance_daily
  for select to authenticated
  using (
    device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
  );

drop policy if exists etime_punch_raw_select on public.etime_punch_raw;
create policy etime_punch_raw_select on public.etime_punch_raw
  for select to authenticated
  using (
    device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
  );

grant select on public.etime_attendance_daily to authenticated;
grant select on public.etime_punch_raw to authenticated;

comment on table public.etime_attendance_daily is 'Daily rollup from eTime DownloadInOutPunchData (B1); filled by server-side sync.';
comment on table public.etime_punch_raw is 'Raw punches from eTime DownloadPunchDataMCID (B2); filled by server-side sync.';
