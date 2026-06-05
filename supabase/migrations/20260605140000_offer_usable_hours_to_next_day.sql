-- Окно использования оффера через полночь (например 22:00–01:00).

alter table public.offer_usable_hours
  add column if not exists to_next_day boolean not null default false;

alter table public.offer_usable_hours
  drop constraint if exists offer_usable_hours_check;

alter table public.offer_usable_hours
  add constraint offer_usable_hours_check
    check (
      (is_unavailable = true and from_time is null and to_time is null and to_next_day = false)
      or (
        is_unavailable = false
        and from_time is not null
        and to_time is not null
        and (
          (to_next_day = false and from_time < to_time)
          or (to_next_day = true and from_time > to_time)
        )
      )
    );
