-- Hero slots reference gallery_images (no separate hero uploads).

alter table public.library_settings
  add column if not exists hero_1_gallery_image_id uuid
    references public.gallery_images (id) on delete set null,
  add column if not exists hero_2_gallery_image_id uuid
    references public.gallery_images (id) on delete set null,
  add column if not exists hero_3_gallery_image_id uuid
    references public.gallery_images (id) on delete set null;

create unique index if not exists library_settings_hero_1_gallery_image_id_key
  on public.library_settings (hero_1_gallery_image_id)
  where hero_1_gallery_image_id is not null;

create unique index if not exists library_settings_hero_2_gallery_image_id_key
  on public.library_settings (hero_2_gallery_image_id)
  where hero_2_gallery_image_id is not null;

create unique index if not exists library_settings_hero_3_gallery_image_id_key
  on public.library_settings (hero_3_gallery_image_id)
  where hero_3_gallery_image_id is not null;
