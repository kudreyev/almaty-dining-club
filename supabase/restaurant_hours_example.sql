-- Пример seed для одного активного ресторана (в пятницу ночной интервал 18:00-02:00).
-- При необходимости замените выбор ресторана на конкретный slug/id.

with target_restaurant as (
  select id
  from public.restaurants
  where is_active = true
  order by created_at asc nulls last
  limit 1
)
insert into public.restaurant_hours (
  restaurant_id,
  day_of_week,
  is_closed,
  open_time,
  close_time,
  close_next_day
)
select
  tr.id,
  d.day_of_week,
  d.is_closed,
  d.open_time::time,
  d.close_time::time,
  d.close_next_day
from target_restaurant tr
cross join (
  values
    (1, false, '10:00', '23:00', false),
    (2, false, '10:00', '23:00', false),
    (3, false, '10:00', '23:00', false),
    (4, false, '10:00', '23:00', false),
    (5, false, '18:00', '02:00', true),
    (6, true, null, null, false),
    (7, true, null, null, false)
) as d(day_of_week, is_closed, open_time, close_time, close_next_day);
