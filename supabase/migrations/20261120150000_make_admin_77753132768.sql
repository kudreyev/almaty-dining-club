-- Сделать админом: +7 775 313 27 68
-- Профиль должен уже существовать (пользователь хотя бы раз залогинился).

do $$
declare
  v_phone text := '+77753132768';
  v_digits text := public.normalize_phone_digits(v_phone);
  v_updated int;
begin
  update public.profiles p
  set role = 'admin'
  where public.normalize_phone_digits(p.phone) = v_digits
     or public.normalize_phone_digits(
          (select u.phone from auth.users u where u.id = p.id limit 1)
        ) = v_digits;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception
      'Профиль с телефоном % не найден. Пусть пользователь сначала войдёт в приложение, затем повторите SQL.',
      v_phone;
  end if;

  raise notice 'admin granted for % (% row(s))', v_phone, v_updated;
end;
$$;
