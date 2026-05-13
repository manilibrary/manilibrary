-- =============================================================================
-- Wipe library domain rows for a clean retest (memberships, payments, KYC).
--
-- Run in Supabase → SQL Editor as postgres (whole script at once).
--
-- Does NOT delete auth.users or public.profiles. Optional profile reset at bottom.
--
-- If you use eTime punch test data, uncomment the etime section.
-- =============================================================================
--
-- Why one TRUNCATE per group: `verification_documents` FK → `verification_requests`.
-- Truncating only `verification_requests` fails. Same idea: `payments` ↔ `memberships`
-- is handled by nulling `payment_id` first, then truncating both together.
-- =============================================================================

begin;

update public.memberships
set payment_id = null
where payment_id is not null;

truncate table
  public.verification_documents,
  public.verification_requests
restart identity cascade;

truncate table
  public.payments,
  public.memberships
restart identity cascade;

-- Optional: punch / device map (uncomment if you seeded these)
-- truncate table public.etime_punch_raw restart identity;
-- truncate table public.etime_attendance_daily restart identity;
-- truncate table public.etime_empcode_map restart identity;

commit;

-- Optional: reset KYC banner fields on all profiles (keeps accounts)
-- update public.profiles
-- set
--   verification_status = 'none',
--   verification_submitted_at = null,
--   verification_reviewed_at = null,
--   updated_at = now();
