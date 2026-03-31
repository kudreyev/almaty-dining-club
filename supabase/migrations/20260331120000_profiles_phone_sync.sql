-- Sync public.profiles.phone from auth.users.phone on signup/login updates.

create or replace function public.sync_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do update
    set phone = coalesce(excluded.phone, public.profiles.phone);

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_phone_on_auth_insert on auth.users;
create trigger trg_sync_profile_phone_on_auth_insert
after insert on auth.users
for each row execute function public.sync_profile_phone();

drop trigger if exists trg_sync_profile_phone_on_auth_update on auth.users;
create trigger trg_sync_profile_phone_on_auth_update
after update of phone on auth.users
for each row execute function public.sync_profile_phone();

-- Backfill existing profiles.
update public.profiles p
set phone = u.phone
from auth.users u
where p.id = u.id
  and p.phone is null
  and u.phone is not null;
