-- Промокоды для чекаута kudaclub.
-- Создание кодов: supabase/scripts/create_promo_code.sql (UI позже).

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_percent numeric(5, 2) null
    check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
  fixed_amount numeric(12, 2) null
    check (fixed_amount is null or fixed_amount > 0),
  applies_to text not null
    check (applies_to in ('first_month', 'forever')),
  max_uses int null
    check (max_uses is null or max_uses > 0),
  used_count int not null default 0
    check (used_count >= 0),
  expires_at timestamptz null,
  campaign_tag text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_discount_xor check (
    (discount_percent is not null and fixed_amount is null)
    or (discount_percent is null and fixed_amount is not null)
  )
);

-- Регистронезависимая уникальность кода.
create unique index if not exists promo_codes_code_lower_uidx
  on public.promo_codes (lower(code));

create index if not exists promo_codes_is_active_idx
  on public.promo_codes (is_active)
  where is_active = true;

create index if not exists promo_codes_campaign_tag_idx
  on public.promo_codes (campaign_tag)
  where campaign_tag is not null;

alter table public.promo_codes enable row level security;

-- Инкремент used_count только после подтверждённой оплаты (Pay-вебхук).
-- Не проверяем лимит здесь: оплата уже прошла; лимит — на этапе validate.
create or replace function public.increment_promo_code_usage(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return false;
  end if;

  update public.promo_codes
  set
    used_count = used_count + 1,
    updated_at = now()
  where lower(code) = lower(trim(p_code));

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.increment_promo_code_usage(text) from public;
grant execute on function public.increment_promo_code_usage(text) to service_role;
