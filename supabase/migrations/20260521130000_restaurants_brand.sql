-- restaurants.brand — для анти-соседства филиалов одной сети в каталоге.
-- Поле опциональное. Если не задано — используется эвристика по имени (см. src/lib/brand.ts).

alter table public.restaurants
  add column if not exists brand text;

create index if not exists restaurants_brand_idx
  on public.restaurants (brand)
  where brand is not null;
