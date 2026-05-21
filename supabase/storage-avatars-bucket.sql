-- Run in Supabase SQL Editor if avatar uploads work but images do not load.
-- Dashboard: Storage → New bucket → name `avatars`, enable **Public bucket**.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;
