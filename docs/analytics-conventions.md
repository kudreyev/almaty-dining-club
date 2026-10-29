# Конвенции аналитики

KudaClub бесплатен для гостей. Основная воронка — от клика «Получить доступ»
до подтверждения кода персоналом. Платёжная воронка TipTop удалена
(см. [payments-archive.md](./payments-archive.md)).

## Воронка гостя

```
login_cta_click → signup_completed → offer_get_click → code_requested → code_redeemed
```

| Событие | Где пишется | Канал | Params / meta |
|---|---|---|---|
| `login_cta_click` | `GoalLink` на кнопках «Получить доступ» | Метрика + `analytics_events` | `source` |
| `signup_completed` | `verifyWhatsAppLoginCode` — первое подтверждение телефона | `analytics_events` (сервер) + цель Метрики (клиент) | `utm_*`, `promo_code` из cookie `kc_utm` |
| `offer_get_click` | кнопка «Получить код» в карточке оффера | Метрика + `analytics_events` | `restaurant_id`, `offer_id`, `is_member` |
| `code_requested` | RPC `issue_redeem_token` (SQL) | `analytics_events` (сервер) + цель Метрики (клиент, один раз на код) | `restaurant_id`, `offer_id`, `token_id` |
| `code_redeemed` | `redeemTokenByCode` (staff) | `analytics_events` (сервер) | `restaurant_id`, `offer_id`, `token_id`, `staff_user_id` |
| `offer_redeemed` | клиент гостя увидел, что код погашен | Метрика + `analytics_events` | `restaurant_id`, `offer_id`, `restaurant_slug`, `offer_type` |
| `partner_cta_click` | «Стать партнёром» | Метрика + `analytics_events` | `source` |

Серверные события: `src/lib/analytics.ts` (`logAnalyticsEvent`).
Клиент: `trackGoal()` (Метрика + `POST /api/track`) и `reachMetricaGoal()` (только Метрика —
для событий, которые сервер уже записал). Allowlist `/api/track`:
`src/lib/client-analytics-events.ts`.

### Source-идентификаторы CTA

| `source` | UI-место |
|---|---|
| `home-hero` | Главная, hero |
| `header` | Шапка |
| `mobile-menu` | Мобильное меню |
| `restaurant-banner` | Баннер на странице заведения |
| `home-venues` | Блок «Для заведений» (partner_cta_click) |

QR-ссылки в заведениях (`/free?utm_source=qr…`) редиректят в каталог города
с сохранением utm; город берётся из `utm_source` / `?city=`.

## Meta Pixel

Только `ViewContent` (страница заведения), `AddToCart` (клик «Получить код»),
`CompleteRegistration` (первая регистрация). Purchase/CAPI удалены.

## Яндекс.Метрика — цели

JavaScript-цели с идентификаторами как в коде: `login_cta_click`, `signup_completed`,
`offer_get_click`, `code_requested`, `offer_redeemed`, `partner_cta_click`,
`whatsapp_click`, `sort_mode_switch`, PWA/push-цели. Cron `metrica-sync` синкает их
(`TRACKED_GOAL_NAMES`). Старые цели оплаты (`cta_click`, `checkout_open`, `purchase`, …)
можно архивировать в Метрике.

## Goal `whatsapp_click` (саппорт)

`WhatsappSupportLink` (`src/components/analytics/whatsapp-support-link.tsx`):
`footer-support`, `support-page`, `support-phone`.

## Live-трекинг в Supabase

```sql
select created_at, event_name, user_id, meta
from public.analytics_events
where event_name in ('signup_completed', 'code_requested', 'code_redeemed')
order by created_at desc
limit 50;
```

Вебхуки TipTop после отключения оплат: `event_name = 'tiptop_webhook_ignored'`.

## Cron-снимки и алерты

Каждую ночь (03:30 Алматы) `/api/cron/daily-snapshot` считает за вчера
`members_total`, `new_members_24h`, `codes_issued_24h`, `redemptions_24h`,
WhatsApp-клики → `metrics_daily_snapshot` → сводка и алерты в Telegram
(0 регистраций, вдвое меньше кодов).

`/api/cron/analytics-digest` (09:00): регистрации, коды, использования, расход на рекламу,
цена регистрации.

`/api/cron/weekly-digest` (пн 04:00): LLM-разбор недели по воронке гостя.

Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`, `OPENAI_API_KEY`.

## Дашборды

- `/admin/dashboard` — гости, воронка 7 дней, активность 30 дней, страховка TipTop.
- `/admin/analytics` — регистрации/коды/использования/расход по дням.

Ежедневный ритуал команды: [analytics-daily-ritual.md](./analytics-daily-ritual.md).
