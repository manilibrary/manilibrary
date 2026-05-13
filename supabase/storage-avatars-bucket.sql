-- Public bucket for member profile photos (safe visibility — library-facing portraits).
-- Uploads use the Next.js service role API (/api/me/avatar); members do not need Storage policies for uploads.
-- Run once in Supabase → SQL Editor. Override bucket id via AVATARS_STORAGE_BUCKET if needed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
