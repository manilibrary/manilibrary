-- Optional member-facing filename for KYC uploads (display + re-upload UX).
alter table public.verification_documents
  add column if not exists original_filename text;

comment on column public.verification_documents.original_filename is
  'Sanitized client filename for display; storage_path remains canonical.';
