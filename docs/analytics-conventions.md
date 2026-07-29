# Конвенции аналитики

Источник правды для трекинга конверсий Kudaclub: основная воронка —
in-app TipTop Pay (`SubscribeCTA` → `CheckoutModal`). WhatsApp-ссылки
остались только для саппорта и activation-ошибок.

## Основная воронка TipTop Pay

```
cta_click → checkout_opened → phone_submitted → otp_verified
  → widget_opened → payment_success | payment_fail | payment_abandoned
```

| Goal | Где | Params |
|---|---|---|
| `cta_click` | `SubscribeCTA` | `source` |
| `checkout_opened` | `CheckoutModal` mount | `source` |
| `phone_submitted` | OTP отправлен | `source` |
| `otp_verified` | код подтверждён | `source` |
| `widget_opened` | TipTop Widget start | `source` |
| `payment_success` | widget status=success | `source` |
| `payment_fail` | ошибка оплаты | `source` |
| `payment_abandoned` | закрыл модалку после виджета без оплаты | `source` |

Компоненты:

- `src/components/checkout/subscribe-cta.tsx` — CTA
- `src/components/checkout/checkout-modal.tsx` — чекаут + Meta Pixel

Каждый `trackGoal()` дублируется в `POST /api/track` → `analytics_events`.

### Source-идентификаторы CTA

| `source` | UI-место |
|---|---|
| `home-hero` | Главная, hero |
| `home-final` | Финальный CTA-блок |
| `pricing` | `/pricing` |
| `header` | Шапка (desktop) |
| `mobile-menu` | Мобильное меню |
| `me-no-sub` | `/app/me`, нет подписки |
| `me-expired` | `/app/me`, истекла |
| `login-no-account` | `/login`, нет аккаунта |
| `home-trial-upgrade` | Trial → paid |
| `venue-cta-{slug}` | Баннер на странице заведения |
| `offer-card-{slug}-{offerId}` | Пейволл из карточки оффера |

## Meta Pixel / CAPI

### TipTop-чекаут

| Событие | Когда | eventID |
|---|---|---|
| `InitiateCheckout` | `checkout_opened` | `checkout_{source}_{unix}` |
| `Purchase` (Pixel) | `payment_success` | `purchase_tiptop_{externalId}` |
| `Purchase` (CAPI) | webhook `/api/tiptoppay/pay` | тот же `purchase_tiptop_{InvoiceId}` |

- `externalId` виджета = `sub_{userId}_{ts}` → в webhook приходит как `InvoiceId`.
- CAPI шлётся **только** для установочных платежей (`InvoiceId` начинается с `sub_`), рекурренты пропускаются.
- Pixel и CAPI дедупятся Meta по общему `eventID`.
- Value: `1990 KZT`.

Хелперы: `src/lib/meta-purchase.ts`, клиент: `src/lib/meta-pixel-client.ts`,
сервер: `src/lib/meta-capi.ts`.

### Activation-ссылки (legacy / gifts / trial)

`/activate` → paid: CAPI + redirect на `/app/me?activated=true&purchase_event_id=…`
→ `MeMetrica` стреляет Pixel `Purchase` / `StartTrial` с тем же eventID.
Не смешивать с TipTop `purchase_tiptop_*`.

### Trial upgrade CTA

`TrialUpgradeLink` — Pixel `InitiateCheckout` (открывает чекаут через `SubscribeCTA`).

## Яндекс.Метрика — чеклист целей

В кабинете Метрики создать **JavaScript-цели** (тип «JavaScript-событие»)
с идентификаторами точно как в коде:

1. `cta_click`
2. `checkout_opened`
3. `phone_submitted`
4. `otp_verified`
5. `widget_opened`
6. `payment_success`
7. `payment_fail`
8. `payment_abandoned`

Затем собрать многошаговую воронку в UI Метрики по этим целям.
Cron `metrica-sync` уже трекает эти имена (`TRACKED_GOAL_NAMES`).

Опционально оставить цель `whatsapp_click` для саппортных ссылок.

## Goal `whatsapp_click` (только саппорт)

Срабатывает на клик по wa.me через `WhatsappSupportLink`
(`src/components/analytics/whatsapp-support-link.tsx`). Meta Pixel не вызывается.

| `source` | UI-место |
|---|---|
| `footer-support` | Футер |
| `support-page` | `/support` |
| `support-phone` | `/support`, номер |
| `activate-error` | `/activate`, ошибки |
| `activate-already-used` | `/activate`, уже использована |
| `activate-card-error` | `ActivateCard` errors |
| `activate-card-intro` | `ActivateCard` intro |

`WhatsappGoalLink` в коде есть, но подписные CTA на него больше не завязаны.

## Live-трекинг в Supabase (Слой 2)

| Источник | Задержка | Назначение |
|---|---|---|
| Яндекс.Метрика | часы / cron | официальная статистика, воронки в UI |
| `analytics_events` | мгновенно | live-дашборд TipTop |

```sql
select created_at, event_name, meta->>'source' as source, meta->>'page' as page
from public.analytics_events
where event_name in (
  'cta_click', 'checkout_opened', 'phone_submitted', 'otp_verified',
  'widget_opened', 'payment_success', 'payment_fail', 'payment_abandoned'
)
order by created_at desc
limit 50;
```

Allowlist: `src/lib/client-analytics-events.ts`.

## Cron-снимки и алерты (Слой 3)

Каждую ночь (03:30 Алматы) `/api/cron/daily-snapshot`:

1. Считает метрики за **вчера** (календарный день Алматы).
2. Upsert в `metrics_daily_snapshot`.
3. Ежедневная сводка в Telegram.
4. Алерты (в т.ч. падение WA-кликов саппорта, ноль подписок).

Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.

## Weekly LLM digest (Слой 4)

Каждый **понедельник 04:00 Алматы** `/api/cron/weekly-digest`.

Env: `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.

```bash
curl -s https://kudaclub.kz/api/cron/weekly-digest \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

## Расширение

Добавление нового подписного CTA:

1. Подобрать `source` и зафиксировать в таблице выше.
2. Обернуть в `SubscribeCTA` с этим `source` (не WhatsApp).
3. Если новый `trackGoal` — добавить имя в `CLIENT_ANALYTICS_EVENTS`
   и при необходимости в `TRACKED_GOAL_NAMES` (`metrica-sync`).

## Analytics ledger + /admin/analytics

Источник правды по подписчикам TipTop (отдельно от продуктового `subscriptions`):

| Таблица | Назначение |
|---|---|
| `subscribers` | status, UTM, promo_code, subscribed_at / cancelled_at |
| `payments` | success/fail, идемпотентность по `ttp_transaction_id` |
| `daily_ad_stats` | spend/impressions/clicks (FB) + visits/goal (Метрика) |

Вебхуки (HMAC `Content-HMAC`, ответ `{code:0}`):

- `POST /api/webhooks/ttp/pay`
- `POST /api/webhooks/ttp/fail`
- `POST /api/webhooks/ttp/recurrent`

UTM: `UtmCapture` пишет cookie `kc_utm` → `CheckoutModal` кладёт в TipTop `metadata` → `JsonData` в вебхуке.

Cron:

| Path | Алматы | Что |
|---|---|---|
| `/api/cron/ad-stats` | 07:00 | FB + Метрика → `daily_ad_stats` |
| `/api/cron/analytics-digest` | 09:00 | Telegram: новые/отмены/расход/CAC |

Дашборд: `/admin/analytics` (`requireAdmin`, `robots: noindex`).
CAC = расход / новые с `utm_medium=paid`; порог стопа — 4000 ₸.
