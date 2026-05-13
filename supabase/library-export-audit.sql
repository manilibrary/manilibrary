-- Audit trail for admin “library workbook” Excel exports (service role only).
-- Run in Supabase SQL Editor after auth.users exists.

create table if not exists public.library_export_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  from_ymd date not null,
  to_ymd date not null,
  directory_rows int not null default 0,
  membership_rows int not null default 0,
  payment_rows int not null default 0,
  attendance_rows int not null default 0,
  attendance_capped boolean not null default false,
  workbook_bytes bigint not null default 0
);

comment on table public.library_export_audit is
  'Who exported what date range and row counts; written by Next.js service role after generating the workbook.';

revoke all on public.library_export_audit from public;
revoke all on public.library_export_audit from anon;
revoke all on public.library_export_audit from authenticated;
grant select, insert, update, delete on public.library_export_audit to service_role;
