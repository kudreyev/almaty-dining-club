alter table public.restaurant_photos
  add column if not exists thumb_url text,
  add column if not exists full_url text,
  add column if not exists thumb_path text,
  add column if not exists full_path text;

update public.restaurant_photos
set
  full_url = coalesce(full_url, public_url, ''),
  thumb_url = coalesce(thumb_url, public_url, ''),
  full_path = coalesce(full_path, storage_path, ''),
  thumb_path = coalesce(thumb_path, storage_path, '')
where
  full_url is null
  or thumb_url is null
  or full_path is null
  or thumb_path is null;

alter table public.restaurant_photos
  alter column thumb_url set not null,
  alter column full_url set not null,
  alter column thumb_path set not null,
  alter column full_path set not null;
