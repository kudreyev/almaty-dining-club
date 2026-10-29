-- Счётчик «Гости уже сэкономили X ₸» для главной и страниц городов.
--
-- Считаем только погашения, подтверждённые персоналом на /staff: строки в redemptions
-- создаёт исключительно redeem_token_atomic. Сотрудники, тестовые аккаунты
-- (profiles.user_kind <> 'customer') и админы не учитываются. Флага «тестовое заведение»
-- в restaurants нет, поэтому заведения не фильтруем.
--
-- Функция отдаёт только три агрегата, без персональных данных. Таблицы для anon
-- не открываются: доступ только через security definer.

create or replace function public.get_savings_stats(city_slug text default null)
returns table (total_saved bigint, guests integer, redemptions integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(coalesce(o.estimated_value, 0)), 0)::bigint as total_saved,
    count(distinct r.user_id)::integer as guests,
    count(*)::integer as redemptions
  from public.redemptions r
  join public.offers o on o.id = r.offer_id
  join public.restaurants rest on rest.id = r.restaurant_id
  left join public.profiles p on p.id = r.user_id
  where coalesce(p.user_kind, 'customer') = 'customer'
    and coalesce(p.role, 'user') <> 'admin'
    and (city_slug is null or rest.city::text = city_slug);
$$;

comment on function public.get_savings_stats(text) is
  'Публичная статистика экономии гостей: сумма estimated_value подтверждённых погашений, число гостей и погашений. Без персональных данных.';

revoke all on function public.get_savings_stats(text) from public;
grant execute on function public.get_savings_stats(text) to anon, authenticated, service_role;
