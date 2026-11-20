-- Починить сеты, ошибочно сохранённые как compliment / с «в подарок» в названии.

-- 1) Офферы с event_id должны быть type=set
update public.offers
set offer_type = 'set'
where event_id is not null
  and offer_type <> 'set';

-- 2) Убрать хвост «в подарок» из названий сетов
update public.offers
set offer_title = trim(regexp_replace(offer_title, '\s*в подарок\s*$', '', 'i'))
where offer_type = 'set'
  and offer_title ~* 'в подарок\s*$';
