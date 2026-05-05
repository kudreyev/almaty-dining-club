alter table public.restaurants
  add column if not exists tags text[] not null default '{}',
  add column if not exists external_rating numeric(3,1),
  add column if not exists external_reviews_count integer;

alter table public.restaurants
  drop constraint if exists restaurants_external_rating_range;

alter table public.restaurants
  add constraint restaurants_external_rating_range
    check (external_rating is null or (external_rating >= 1.0 and external_rating <= 5.0));

alter table public.restaurants
  drop constraint if exists restaurants_external_reviews_count_nonneg;

alter table public.restaurants
  add constraint restaurants_external_reviews_count_nonneg
    check (external_reviews_count is null or external_reviews_count >= 0);

alter table public.offers
  add column if not exists dish_photo_url text;
