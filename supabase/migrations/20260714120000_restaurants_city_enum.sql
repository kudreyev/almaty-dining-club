-- Второй город: Астана. Каталог фильтруется по городу; подписка общая на все города.
--
-- Колонка restaurants.city уже существует (`text not null default 'almaty'`) и заполнена,
-- поэтому бэкфилл не нужен. Конвертируем существующий text-столбец в enum `city`.
-- Флаг публикации: переиспользуется существующий is_active, отдельный is_published не заводится.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'city') then
    create type city as enum ('almaty', 'astana');
  end if;
end
$$;

alter table public.restaurants alter column city drop default;
alter table public.restaurants alter column city type city using city::city;
alter table public.restaurants alter column city set default 'almaty'::city;

create index if not exists restaurants_city_idx on public.restaurants (city);
