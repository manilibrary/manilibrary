-- =============================================================================
-- One-time migration: payments.amount_minor (paise) → amount_rupees (rupees)
-- Run in Supabase → SQL Editor (postgres / dashboard role).
--
-- No-op if amount_minor is already gone (schema already on amount_rupees).
-- =============================================================================

alter table public.payments add column if not exists amount_rupees bigint;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'amount_minor'
  ) then
    update public.payments
    set amount_rupees = greatest(0, (amount_minor / 100)::bigint);

    alter table public.payments alter column amount_rupees set not null;
    alter table public.payments drop column amount_minor;
  end if;
end $$;

alter table public.payments alter column amount_rupees set not null;

comment on column public.payments.amount_rupees is
  'INR amount in whole rupees (e.g. 500 = ₹500). Razorpay API uses paise; app multiplies by 100 for orders.';
