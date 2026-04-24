alter table public.restaurants enable row level security;

drop policy if exists "restaurants_admin_select" on public.restaurants;
create policy "restaurants_admin_select"
  on public.restaurants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

