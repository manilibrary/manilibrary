-- Snapshot of processed admin daily attendance (one row per library calendar day).
-- Run in Supabase SQL editor after other public tables exist.

create table if not exists public.attendance_day_snapshots (
  id uuid primary key default gen_random_uuid(),
  library_day_ymd date not null,
  device_from_dmy text not null,
  device_to_dmy text not null,
  source text not null,
  items jsonb not null,
  skipped_unregistered int not null default 0,
  archived_at timestamptz not null default now(),
  unique (library_day_ymd)
);

create index if not exists attendance_day_snapshots_day_idx
  on public.attendance_day_snapshots (library_day_ymd desc);

comment on table public.attendance_day_snapshots is
  'Frozen JSON snapshot from admin daily attendance processing for a library day; optional cron or manual POST.';

-- ---------------------------------------------------------------------------
-- Normalized rows for reporting / filters (one row per member per archived day).
-- Populated together with attendance_day_snapshots by archive POST / cron.
-- ---------------------------------------------------------------------------

create table if not exists public.attendance_history_entries (
  id bigint generated always as identity primary key,
  library_day_ymd date not null,
  date_dmy text not null,
  member_number int not null,
  empcode text not null,
  full_name text,
  seat_label text not null default '—',
  in_time text not null default '',
  out_time text not null default '',
  work_time text not null default '',
  status text not null default '',
  status_ui text not null default 'other',
  status_ui_label text not null default '—',
  remark text not null default '',
  source text not null,
  archived_at timestamptz not null default now()
);

create index if not exists attendance_history_entries_day_idx
  on public.attendance_history_entries (library_day_ymd desc);

create index if not exists attendance_history_entries_member_idx
  on public.attendance_history_entries (member_number);

comment on table public.attendance_history_entries is
  'Per-member daily attendance history copied when a day is archived (POST /api/admin/attendance/archive-day or cron).';
