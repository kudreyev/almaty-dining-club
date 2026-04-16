alter table public.restaurants
  drop column if exists short_description,
  drop column if exists description,
  drop column if exists full_description;
