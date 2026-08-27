-- Промокод FREE30: первый месяц 1 ₸ (100% скидка → floor 1 ₸) для QR Алматы.
-- Запускать в SQL Editor Supabase.
--
-- QR-ссылки (одна на город):
--   Алматы: https://kudaclub.kz/free?promo=FREE30&utm_source=qr
--   Астана: https://kudaclub.kz/free?promo=FREE30&utm_source=qr_astana

delete from public.promo_codes where lower(code) = lower('FREE30');

insert into public.promo_codes (
  code,
  discount_percent,
  fixed_amount,
  applies_to,
  max_uses,
  expires_at,
  campaign_tag,
  is_active
) values (
  'FREE30',
  100,
  null,
  'first_month',
  null,
  null,
  'qr_almaty',
  true
);
