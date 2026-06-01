-- Отметить стафф по телефонам и выдать бессрочную подписку.
-- Перед применением добавьте номера в массив ниже (E.164: +77001234567).

do $$
declare
  staff_phones text[] := array[
    -- '+77001234567',
  ];
  v_marked int;
  v_user_id uuid;
  v_ensured int := 0;
begin
  v_marked := public.mark_profiles_staff_by_phones(staff_phones);
  raise notice 'profiles marked as staff: %', v_marked;

  for v_user_id in
    select p.id from public.profiles p where p.user_kind = 'staff'
  loop
    perform public.ensure_staff_subscription(v_user_id);
    v_ensured := v_ensured + 1;
  end loop;

  raise notice 'staff subscriptions ensured: %', v_ensured;
end;
$$;
