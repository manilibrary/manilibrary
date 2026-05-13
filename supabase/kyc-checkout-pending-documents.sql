-- Optional KYC file uploads during membership checkout before payment succeeds.
-- App promotes rows into verification_documents after Razorpay verify/reconcile.
-- Re-upload on the same screen replaces the row (and deletes the previous object).

create table if not exists public.kyc_checkout_pending_documents (
  user_id          uuid not null references auth.users (id) on delete cascade,
  doc_type         text not null
                     check (doc_type in ('aadhaar_front', 'aadhaar_back', 'student_id')),
  storage_bucket   text not null default 'kyc-private',
  storage_path     text not null,
  content_type     text not null,
  updated_at       timestamptz not null default now(),
  primary key (user_id, doc_type)
);

create index if not exists kyc_checkout_pending_documents_updated_idx
  on public.kyc_checkout_pending_documents (updated_at);

alter table public.kyc_checkout_pending_documents enable row level security;

comment on table public.kyc_checkout_pending_documents is
  'Staging for optional ID uploads on membership checkout. Service role only; promoted after payment.';

grant all on public.kyc_checkout_pending_documents to service_role;
