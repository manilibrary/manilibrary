-- Public library photo gallery (admin-managed, max 50 active images).

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  public_url text not null,
  content_type text not null,
  sort_order integer not null default 0,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint gallery_images_content_type_check
    check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint gallery_images_storage_path_len_check
    check (char_length(storage_path) <= 512),
  constraint gallery_images_public_url_len_check
    check (char_length(public_url) <= 2048)
);

create unique index if not exists gallery_images_storage_path_active_key
  on public.gallery_images (storage_path)
  where deleted_at is null;

create index if not exists gallery_images_active_sort_idx
  on public.gallery_images (sort_order asc, created_at asc)
  where deleted_at is null;

alter table public.gallery_images enable row level security;
