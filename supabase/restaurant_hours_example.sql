-- Пример seed для одного активного ресторана (пн-пт 10:00-23:00, сб-вс выходной).
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
  close_time
)
select
  tr.id,
  d.day_of_week,
  d.is_closed,
  d.open_time::time,
  d.close_time::time
from target_restaurant tr
cross join (
  values
    (1, false, '10:00', '23:00'),
    (2, false, '10:00', '23:00'),
    (3, false, '10:00', '23:00'),
    (4, false, '10:00', '23:00'),
    (5, false, '10:00', '23:00'),
    (6, true, null, null),
    (7, true, null, null)
) as d(day_of_week, is_closed, open_time, close_time);
