alter table public.restaurants
  alter column price_level drop not null;

update public.restaurants
set price_level = 'mid'
where price_level is null;

