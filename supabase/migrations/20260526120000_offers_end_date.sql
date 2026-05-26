-- Дата окончания оффера в каталоге (Kudafest и другие временные акции).
-- NULL — без срока (обычные офферы Kudaclub).

alter table public.offers
  add column if not exists end_date date;

comment on column public.offers.end_date is
  'Последний день показа оффера в каталоге (включительно), по календарю Asia/Almaty. NULL — бессрочно.';
