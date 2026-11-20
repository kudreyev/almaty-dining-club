-- Тестовые заведения TestFest не должны быть в публичном каталоге.
update public.restaurants
set is_active = false
where slug like 'testfest-%';
