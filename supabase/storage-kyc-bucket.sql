-- Private bucket for KYC uploads (Aadhaar / student ID). Run once in Supabase → SQL Editor.
-- Uploads use the service role from Next.js; members do not need direct Storage read/write policies for upload to work.
-- After this, document uploads on /dashboard/me should succeed (or set KYC_STORAGE_BUCKET to match your bucket id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-private',
  'kyc-private',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do nothing;
