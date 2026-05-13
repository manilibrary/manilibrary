-- Remove analysis views if they were created earlier (they show in Table Editor like extra tables).
-- Run once in Supabase → SQL Editor.

drop view if exists public.memberships_with_member;
drop view if exists public.payments_with_member;
drop view if exists public.verification_requests_with_member;
