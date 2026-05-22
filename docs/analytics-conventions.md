# Конвенции аналитики

Источник правды для трекинга WhatsApp-кликов и текста сообщений
в WhatsApp.

## Goal `whatsapp_click`

Срабатывает на каждый клик по wa.me-ссылке на сайте. Параметр `source`
обязателен и идентифицирует точку клика. Сам goal вызывается из двух
переиспользуемых компонентов:

- `src/components/analytics/whatsapp-goal-link.tsx` — подписные CTA
  (дополнительно дёргает Meta Pixel `InitiateCheckout`).
- `src/components/analytics/whatsapp-support-link.tsx` — саппортные
  ссылки (без Meta Pixel — это не подписной CTA).

### Статические source-идентификаторы

Подписные CTA (через `WhatsappGoalLink`):

| `source` | UI-место |
|---|---|
| `home-hero` | Главная, hero-кнопка «Попробовать за 1 990 ₸» |
| `home-pricing` | Главная, финальный CTA-блок (`final-cta.tsx`) |
| `pricing-page` | Страница `/pricing`, CTA в карточке тарифа |
| `header-cta` | Кнопка в шапке (desktop) |
| `mobile-menu-cta` | Кнопка в раскрытом мобильном меню |
| `me-no-sub` | `/app/me`, кнопка «Оформить» при отсутствии подписки |
| `me-expired` | `/app/me`, кнопка «Продлить» при истёкшей подписке |
| `login-no-account` | `/login`, экран «нет аккаунта» |
| `home-trial-upgrade` | Главная, ссылка «Оформить полную подписку» для trial-юзера |

Саппортные ссылки (через `WhatsappSupportLink`):

| `source` | UI-место |
|---|---|
| `footer-support` | Футер, ссылка «Написать нам» |
| `support-page` | `/support`, основная кнопка |
| `support-phone` | `/support`, inline-номер телефона в блоке контактов |
| `activate-error` | `/activate`, состояния «не найдена / отменена / истекла» |
| `activate-already-used` | `/activate`, состояние «уже использована» |
| `activate-card-error` | `/activate`, error-состояния `ActivateCard` |
| `activate-card-intro` | `/activate`, intro-экран `ActivateCard` |

### Динамические source-идентификаторы

Гранулярность по ресторану / офферу намеренна — позволяет считать
конверсию в Метрике в разрезе конкретного места:

| Формат | Конструктор | UI-место |
|---|---|---|
| `venue-cta-{slug}` | `venueCtaSource(slug)` в `src/lib/whatsapp.ts` | CTA-баннер на странице заведения |
| `offer-card-{slug}-{offerId}` | `offerCardSource(slug, offerId)` в `src/lib/whatsapp.ts` | Пейволл, открываемый из карточки оффера |

## Текст сообщения в WhatsApp

Текст подписного CTA выбирается из `WhatsAppMessageKind` в
`src/lib/whatsapp.ts`. Не путать с `source` для Метрики: `source`
включает slug, `messageKind` — это «базовый» тип CTA без slug.

| `messageKind` | Текст сообщения |
|---|---|
| `header-cta`, `mobile-menu-cta` | «Здравствуйте! Интересует подписка Kudaclub» |
| `home-hero`, `me-no-sub`, `login-no-account` | «Здравствуйте! Хочу подписку Kudaclub» |
| `home-pricing`, `pricing-page`, `home-trial-upgrade` | «Здравствуйте! Хочу оформить подписку Kudaclub» |
| `venue-cta`, `offer-card` (с `restaurantName`) | «Здравствуйте! Хочу подписку Kudaclub. Хочу попробовать {restaurantName}» |
| `me-expired` | «Здравствуйте! Хочу продлить подписку Kudaclub» |
| любой без kind | «Здравствуйте! Хочу подписку Kudaclub» (дефолт) |

Логика — менеджер в WhatsApp по тексту входящего сообщения сразу
понимает источник и температуру лида:

- «Интересует подписка» → шапка / меню (холодный).
- «Хочу подписку» → главная или login-форма (тёплый).
- «Хочу оформить подписку» → знает цену, прошёл pricing-блок (горячий).
- «Хочу подписку Kudaclub. Хочу попробовать {restaurant}» → знает,
  куда хочет (самый горячий).
- «Хочу продлить» → возвращающийся клиент (самый ценный).

Саппортные ссылки текст не меняют: `WhatsappSupportLink` принимает
готовый `href`, в котором текст либо отсутствует, либо захардкожен
(«Нужна помощь с активацией подписки Kudaclub» для `activate*` точек).

## Meta Pixel `InitiateCheckout`

Срабатывает только в `WhatsappGoalLink` (подписные CTA) с
`{ value: 1990, currency: 'KZT' }`. В `WhatsappSupportLink`
не вызывается — саппорт не является событием инициации оплаты.

## Live-трекинг в Supabase (Слой 2)

Каждый вызов `trackGoal()` дублируется в `POST /api/track` → таблица
`analytics_events` (поле `meta` = params + `page`).

| Источник | Задержка | Назначение |
|---|---|---|
| Яндекс.Метрика | часы / cron | официальная статистика, воронки в UI |
| `analytics_events` | мгновенно | SQL-джойны с подписками, live-дашборд |

Пример запроса:

```sql
select created_at, event_name, meta->>'source' as source, meta->>'page' as page
from public.analytics_events
where event_name = 'whatsapp_click'
order by created_at desc
limit 50;
```

Allowlist событий: `src/lib/client-analytics-events.ts`.

## Cron-снимки и алерты (Слой 3)

Каждую ночь (03:30 Алматы) `/api/cron/daily-snapshot`:

1. Считает метрики за **вчера** (календарный день Алматы).
2. Upsert в `metrics_daily_snapshot`.
3. Сравнивает с предыдущим днём → Telegram, если сработали правила:

| Правило | Условие |
|---|---|
| Падение WhatsApp | кликов < 50% от предыдущего дня |
| Ноль подписок | `new_subs_24h = 0`, вчера было > 0 |
| Ошибки активации | > 5 кликов `activate-error` + `activate-card-error` |

Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.

Пример запроса истории:

```sql
select date, active_subscribers, new_subs_24h, whatsapp_clicks_24h, mrr_kzt
from public.metrics_daily_snapshot
order by date desc
limit 14;
```

## Расширение

Добавление нового CTA:

1. Подобрать `source` (статический или динамический через helper в
   `src/lib/whatsapp.ts`) и зафиксировать в этой таблице.
2. Если нужен отдельный текст в WhatsApp — добавить ветку
   в `WhatsAppMessageKind` и в `getWhatsAppText` (`src/lib/whatsapp.ts`).
3. Использовать `WhatsappGoalLink` (подписной CTA) или
   `WhatsappSupportLink` (саппорт).
4. Добавить имя события в `CLIENT_ANALYTICS_EVENTS`
   (`src/lib/client-analytics-events.ts`), если это новый `trackGoal`.
