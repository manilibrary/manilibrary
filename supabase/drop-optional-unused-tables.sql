-- =============================================================================
-- Drop optional / unused tables (manilibrary app does not read these via PostgREST)
-- =============================================================================
-- Run in Supabase SQL Editor on a BACKUP / staging project first.
--
-- What this removes
--   • v2 staging & sync: member_manual_import, device_api_sync_state
--   • v2 tables the app never queries (only superadmin purge touched some):
--       device_api_records, etime_empcode_map
--   • site_visits + site_visit_overview_stats() — use drop-site-visits.sql
--   • Legacy objects IF they still exist from older SQL bundles:
--       attendance_day_snapshots, attendance_history_entries,
--       etime_punch_raw, etime_attendance_daily,
--       kyc_checkout_pending_documents
--
-- What this does NOT remove
--   • membership_events — rows are inserted by triggers on public.memberships
--   • verification_requests — only drop manually after you confirm your
--       verification_documents rows reference public.verification (v2), not
--       verification_requests (old bootstrap). Dropping the wrong parent can
--       CASCADE and delete document rows.
--
-- After this script: redeploy app code that no longer DELETEs dropped tables
-- (purge-user-data.ts was updated in-repo).
--
-- If you re-run an RLS bootstrap script that references dropped tables, edit
-- that script or skip those sections.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Legacy alternate archive / eTime mirror tables (IF EXISTS)
-- ---------------------------------------------------------------------------
drop table if exists public.attendance_history_entries cascade;
drop table if exists public.attendance_day_snapshots cascade;
drop table if exists public.etime_punch_raw cascade;
drop table if exists public.etime_attendance_daily cascade;
drop table if exists public.kyc_checkout_pending_documents cascade;

-- ---------------------------------------------------------------------------
-- v2 optional tables (see library-schema-v2-organized.sql)
-- ---------------------------------------------------------------------------
-- Children of profiles(device_user_id) first (FK to profiles, not the other way)
drop table if exists public.device_api_records cascade;
drop table if exists public.etime_empcode_map cascade;

drop table if exists public.member_manual_import cascade;
drop table if exists public.device_api_sync_state cascade;

commit;

-- =============================================================================
-- OPTIONAL (manual only): public.verification_requests
-- =============================================================================
-- Run ONLY if you have confirmed that public.verification_documents.verification_id
-- references public.verification (v2), NOT public.verification_requests (old bootstrap).
-- Wrong order will CASCADE-delete document rows or fail on FK.
--
-- drop table if exists public.verification_requests cascade;
