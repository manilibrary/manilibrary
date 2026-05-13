-- =============================================================================
-- Pending memberships: copy chosen seat to payments.metadata, then store
-- memberships.seat_number = 'Not applicable' until payment succeeds.
-- Run once in Supabase SQL Editor (backup first). Safe to re-run: skips rows
-- that already have planned_seat_token or already show Not applicable.
-- =============================================================================

begin;

update public.payments p
set
  metadata = coalesce(p.metadata, '{}'::jsonb)
    || jsonb_build_object('planned_seat_token', trim(both from m.seat_number::text)),
  updated_at = now()
from public.memberships m
where p.membership_id = m.id
  and m.status = 'pending_payment'
  and m.seat_number is not null
  and lower(trim(m.seat_number::text)) <> lower('Not applicable')
  and coalesce(p.metadata->>'planned_seat_token', '') = '';

update public.memberships
set
  seat_number = 'Not applicable',
  updated_at = now()
where status = 'pending_payment'
  and (
    seat_number is null
    or lower(trim(seat_number::text)) <> lower('Not applicable')
  );

commit;
