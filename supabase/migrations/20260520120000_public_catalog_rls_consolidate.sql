-- Консолидация RLS для публичного каталога (рестораны, офферы, фото, локации).
--
-- На проде одновременно существовали:
--   - дублирующие политики SELECT (одинаковый или более слабый qual);
--   - старые политики «Admins can …» на роль public (EXISTS в profiles);
--   - новые политики *_admin_all на authenticated (is_profile_admin).
--
-- После миграции остаётся ровно по одной паре: публичное чтение + админ ALL,
-- как в 20260320120000_baseline_public_schema.sql.

-- ---------------------------------------------------------------------------
-- public.restaurants
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read active restaurants" on public.restaurants;
drop policy if exists "Admins can read restaurants" on public.restaurants;
drop policy if exists "Admins can insert restaurants" on public.restaurants;
drop policy if exists "Admins can update restaurants" on public.restaurants;
drop policy if exists "Admins can delete restaurants" on public.restaurants;

-- Остаются: restaurants_public_read_active, restaurants_admin_all

-- ---------------------------------------------------------------------------
-- public.offers
-- Удаляем дубликат SELECT только по is_active (слабее, чем offers_public_read).
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read active offers" on public.offers;
drop policy if exists "Admins can delete offers" on public.offers;
drop policy if exists "Admins can insert offers" on public.offers;
drop policy if exists "Admins can update offers" on public.offers;

-- Остаются: offers_public_read, offers_admin_all

-- ---------------------------------------------------------------------------
-- public.restaurant_locations
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read active locations" on public.restaurant_locations;
drop policy if exists "Admins can delete locations" on public.restaurant_locations;
drop policy if exists "Admins can insert locations" on public.restaurant_locations;
drop policy if exists "Admins can update locations" on public.restaurant_locations;

-- Остаются: restaurant_locations_public_read, restaurant_locations_admin_all

-- ---------------------------------------------------------------------------
-- public.restaurant_photos
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read active restaurant photos" on public.restaurant_photos;
drop policy if exists "Admins manage restaurant photos" on public.restaurant_photos;

-- Остаются: restaurant_photos_public_read, restaurant_photos_admin_all
