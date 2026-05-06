# Security audit — Kudaclub (Kudapass) — 2026

Область: репозиторий `/Users/tairkudreyev/Desktop/kudapass-apr7` на момент проверки. Формат: конкретные места в коде и риск, без общих рекомендаций.

---

## 1. Supabase Row Level Security

### 1.1 Неполная картина схемы в репозитории

**Файлы:** только `supabase/migrations/*.sql`  
**Риск:** Таблицы `public.profiles`, `public.subscriptions`, `public.payment_requests`, `public.redeem_tokens`, `public.offers`, `public.redemptions`, `public.staff_users` и др. **упоминаются в коде и SQL**, но **нет миграций** с `CREATE TABLE` / `ENABLE ROW LEVEL SECURITY` / политиками для большинства из них. Невозможно подтвердить из репозитория, включён ли RLS и какие политики на проде для персональных данных и платежей — возможен **дрейф** между репо и Supabase Dashboard.

### 1.2 Политика `restaurants` vs публичный каталог

**Файл:** `supabase/migrations/20260415193000_restaurants_admin_select_policy.sql` (стр. 1–15)  
**Код приложения:** `src/app/page.tsx` (стр. 35–36) — `createSupabasePublicClient()` (анонимный JWT).

**Суть:** Политика `restaurants_admin_select` разрешает `SELECT` только роли **`authenticated`** при `profiles.role = 'admin'`. Анонимная сессия (`anon`) такой политикой **не покрывается**; при строгом RLS строки `restaurants` для неавторизованного клиента не читаются.

**Риск:** Либо в продакшене добавлены **неверсионированные** политики на чтение для гостей (каталог), либо конфигурация БД не соответствует миграциям в репо. В первом случае **политика доступа к каталогу не поддаётся код-ревью** в git.

### 1.3 `staff_sessions`: RLS без политик в миграции

**Файл:** `supabase/migrations/20260408120000_redeem_extend_staff_sessions.sql` (стр. 43)  
**Риск:** Для ролей `anon`/`authenticated` при отсутствии `CREATE POLICY` действует запрет. Доступ к таблице в коде идёт через `createSupabaseAdminClient()` (**service_role** обходит RLS). Это **ожидаемо** для серверной модели; уязвимость возникнет, если кто-то добавит политику «разрешить всё» без ограничений.

### 1.4 `activation_links` и `analytics_events`: только админ по JWT

**Файлы:** `supabase/migrations/20260329120000_activation_links.sql`, `20260330120000_analytics_events.sql`  
**Риск:** Для ключей приложения с сессией пользователя доступ к этим таблицам только как у **admin** в `profiles`. Обычный пользователь через anon/authenticated **не** читает чужие токены активации напрямую из БД — при условии, что серверные вызовы с **service_role** не подставляются в клиент (см. раздел 2).

---

## 2. Environment variables и service_role

### 2.1 Service role только в серверном коде (по структуре импорта)

**Файл:** `src/lib/supabase/admin.ts` (стр. 11–14) — `SUPABASE_SERVICE_ROLE_KEY`.

**Использование** (неполный список): `src/lib/staff-session.ts`, `src/lib/activation-links.ts`, `src/lib/analytics.ts`, `src/lib/auth/whatsapp-login.ts`, Server Actions/API, async **server components** (`src/app/activate/page.tsx`, `src/app/staff/redeem/page.tsx`).

**Риск:** При ошибочной пометке файла как `'use client'` или импорте `admin.ts` в клиентский компонент ключ окажется в бандле. **В текущей раскладке файлов** явного клиентского импорта `createSupabaseAdminClient` не обнаружено; риск — **архитектурный / при будущих правках**.

### 2.2 `.gitignore` и `.env`

**Файл:** `.gitignore` (стр. 33–35) — `.env*` с исключением `!.env.example`.

**Риск:** Секреты в рабочей копии не должны попадать в git при обычном коммите. В текущем дереве **файла `.env.example` нет** (возможно удалён); история git содержит коммиты, где `.env.example` менялся (см. git log).

### 2.3 Плейсхолдеры в CI

**Файл:** `.github/workflows/ci.yml` (стр. 26–28) — JWT-подобные строки `ci_placeholder` для публичного anon и service role.

**Риск:** Это **не реальные секреты**; утечки нет. Сборка не проверяет валидность ключей Supabase.

---

## 3. Authentication & authorization

### 3.1 Middleware не разграничивает маршруты

**Файл:** `middleware.ts` (стр. 4–29) — только `createServerClient` + `getUser()`, без `redirect` для `/admin`, `/staff`, `/app`.

**Риск:** Защита страниц полностью на **layout/page/actions**. Это рабочая схема, но **нет централизованного** запрета; ошибка пропуска `requireAdmin` на новой странице = уязвимость.

### 3.2 Админ-страница платежей дублирует проверку вручную

**Файл:** `src/app/admin/payments/page.tsx` (стр. 35–50) — проверка `auth.getUser()` и `profile.role === 'admin'` **без** вызова общего `requireAdmin()`.

**Риск:** Та же логика, что в `src/lib/admin.ts`, но **дублирование** увеличивает шанс рассинхрона при изменении правил.

### 3.3 Staff redeem: проверка контекста на сервере

**Файл:** `src/app/staff/redeem/actions.ts` (стр. 12–34, 84–91) — `requireStaffContext()` и привязка `redeem_tokens` к `restaurant_id` сессии.

**Риск:** Логика авторизации на сервере присутствует; **не** только клиент.

---

## 4. API routes

**Единственный найденный маршрут:** `src/app/api/admin/restaurants/[id]/photos/route.ts`.

### 4.1 Авторизация и утечка текста ошибки Supabase

**Файл:** стр. 22–44 (`ensureAdmin`), стр. 36–37.

```36:37:src/app/api/admin/restaurants/[id]/photos/route.ts
  if (profileError) {
    return { ok: false as const, response: jsonError(`Ошибка проверки прав: ${profileError.message}`, 500) }
```

**Риск:** Сообщение об ошибке PostgREST/БД может попасть клиенту в JSON (**информационная утечка** инфраструктуры в production).

### 4.2 Валидация и rate limiting

**Файл:** тот же `route.ts` (POST) — проверка роли admin, лимит файлов (стр. 107–109), тип `image/webp` при upload.

**Риск:** **Нет** явного rate limiting на уровне API (полагается на хостинг/Vercel). **Нет** Zod/Yup — проверка размеров/полей вручную.

### 4.3 CSRF (Route Handler)

**Риск:** POST без отдельного CSRF-токена; для cookie-сессии Supabase и SameSite обычно достаточно в типичном деплое, но строгая модель «double submit» **не реализована**.

---

## 5. Input validation и XSS

### 5.1 Нет `dangerouslySetInnerHTML` в проекте

Поиск по репозиторию — **вхождений нет**.

### 5.2 UGC и экранирование

Комментарии пользователей и тексты выводятся через React как текст (`payment_requests.comment_from_user` в `src/app/admin/payments/page.tsx` стр. 96–99).

**Риск:** React по умолчанию экранирует; **XSS через HTML-инъекцию** в этих местах низкий, если нет сырых HTML-шаблонов.

### 5.3 Серверная валидация платёжной формы

**Файл:** `src/components/payment-request-form.tsx` (стр. 26–31) — `insert` из **клиента** с полями `amount`, `payment_code`, `comment_from_user`.

**Риск:** Сумма и код заявки задаются на клиенте; **нет** серверного Server Action с Zod, пересчитывающего допустимую сумму. Итоговая безопасность зависит от **RLS** и ограничений БД (в репозитории не описаны).

---

## 6. PII и персональные данные

### 6.1 Телефон и токен в URL

**Файл:** `src/app/activate/page.tsx` (стр. 17–24) — `loginRedirectWithNext`: в query добавляются `token`, затем `phone` в `/login/whatsapp?...`.

**Риск:** Телефон и секрет активации попадают в **URL** (логи прокси, Referer, история браузера, аналитика).

### 6.2 Логирование PII в server actions

**Файл:** `src/app/login/actions.ts` (стр. 185–188) — `console.log` с `user.id`, `phoneFromCookie`, `user_metadata`, `phoneE164`.

**Файл:** `src/lib/profile-sync.ts` (стр. 27) — `console.log` с `userId` и **полным телефоном**.

**Файл:** `src/lib/auth/whatsapp-login.ts` (стр. 99–110) — логи с `phoneE164` и id пользователя.

**Риск:** В production логи (Vercel/другие сборщики) получают **персональные данные** и метаданные учётки — утечка при доступе к логам.

### 6.3 Аналитика: телефон и хеш токена

**Файл:** `src/lib/analytics.ts` (стр. 34–40) — запись `phone_target`, `token_hash` (SHA-256 prefix).

**Риск:** `phone_target` — PII в таблице `analytics_events`; `token_hash` — снижает риск полного восстановления токена, но остаётся корреляция.

### 6.4 Механизм удаления данных

В коде приложения **не** найден отдельный поток «удалить пользователя и PII» (поиск по маршрутам `/privacy`, `delete` и т.п.).

**Риск:** Соответствие GDPR/локальным требованиям **не подтверждается** кодом.

---

## 7. WhatsApp / OTP / токены активации

### 7.1 Токен активации подписки (криптостойкость)

**Файл:** `src/lib/activation-links.ts` (стр. 44–47, 230–231) — `crypto.getRandomValues`, 32 hex символа.

**Риск:** Низкий по предсказуемости; **не** `Math.random`.

### 7.2 Срок действия ссылки при создании админом

**Файл:** `src/app/admin/activation-links/actions.ts` (стр. 22–23) — `expires_at` = **24 часа** с момента создания.

**Файл:** миграция `20260329120000_activation_links.sql` (стр. 15) — default **7 дней**.

**Риск:** Несоответствие дефолта в БД и в приложении может путать при ручных вставках в БД; для API создания через код действует **24ч**.

### 7.3 OTP входа WhatsApp

**Файл:** `src/app/login/actions.ts` (стр. 45–46) — `randomInt` из `node:crypto` для 6-значного кода.

**Риск:** Криптостойкий генератор; ок.

### 7.4 Replay

Сессия после `verifyWhatsAppLoginCode` очищает cookie challenge (стр. 196–197). OTP привязан к одноразовой верификации Supabase.

**Риск сценария «UUID одного пользователя → данные другого»:** не напрямую; кросс-аккаунт требует компромисса токенов Supabase или обхода телефона/ссылки активации.

---

## 8. Payment flows

### 8.1 Клиент задаёт сумму и код платежа

**Файл:** `src/components/payment-request-form.tsx` (стр. 7–8, 13–16, 26–31).

**Строки 7–8:** `Math.random` для `KP-xxxxxx`.

**Риски:**

- **Предсказуемость кода** заявки (ограниченное пространство + `Math.random` не криптографический).
- **Сумма не валидируется на отдельном серверном экшене** с жёстким списком допустимых значений — зависит от RLS/constraint в БД (в репозитории не видно).

### 8.2 Подтверждение заявки админом: `userId` из формы

**Файл:** `src/app/admin/payments/actions.ts` (стр. 30–33, 86–95) — `userId` и `amount` берутся из `FormData`, при этом строка заявки обновляется по `paymentRequestId` без повторного **`select` сроки `payment_requests` и сравнения `user_id` из БД**.

**Риск:** При подмене скрытых полей формы (CSRF + злоумышленник с сессией админа, или XSS в админке) возможна **рассогласованная** запись: заявка помечена approved для одной связки, подписка создаётся для **другого** `userId` из подделанного поля (**IDOR / нарушение целостности** между `payment_requests` и `subscriptions`).

### 8.3 Webhooks платёжного провайдера

В репозитории **не** найдены маршруты webhook Kaspi/банка — ручное подтверждение админом.

---

## 9. Code injection

Поиск `eval`, `new Function`, `child_process.exec` — **вхождений нет**.

SQL только через SDK Supabase (параметризованные запросы), сырой SQL строкой от пользователя **не** обнаружен.

---

## 10. Зависимости (`npm audit`)

Выполнено: `npm audit` (2026). Уязвимости с уровнем **high** (и выше по отчёту инструмента):

| Пакет | Серьёзность | Идентификаторы (из вывода npm) |
|--------|---------------|----------------------------------|
| **next** 16.1.6 | high / moderate | GHSA-ggv3-7p47-pfv8, GHSA-3x4c-7xq6-9pq8, GHSA-h27x-g6w4-24gq, **GHSA-mq59-m269-xvcx** (null origin / Server Actions CSRF), GHSA-q4gf-8mx6-v5v3 (DoS Server Components), др. |
| **flatted** | high | GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh |
| **picomatch** | high | GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj |

**Риск:** В частности **GHSA-mq59-m269-xvcx** относится к обходу проверок CSRF для Server Actions при определённых Origin — релевантно для `approvePaymentRequest` / других server actions.

---

## 11. CORS и security headers

**Файл:** `next.config.ts` (стр. 3–10) — только `images.remotePatterns`, **нет** `headers()` с `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`.

**Риск:** Защитные заголовки полагаются на **Vercel по умолчанию** или отсутствуют; **CSP** для ограничения скриптов/iframe **не** задан в конфиге приложения.

---

## 12. Обработка ошибок

**Файл:** `src/app/api/admin/restaurants/[id]/photos/route.ts` — см. §4.1.

**Файл:** `src/app/r/[slug]/page.tsx` (около стр. 227–232, по grep) — вывод `offersError.message` пользователю на странице ошибки.

**Риск:** Утечка формулировок ошибок PostgREST/сети пользователю.

**Файл:** `src/lib/auth/whatsapp-login.ts` (стр. 218–220) — `throw new Error` с телом ответа Twilio.

**Риск:** Ошибка может содержать детали внешнего API; зависит от того, где ловится исключение (пользователю в `login/actions.ts` возвращается `error.message` стр. 132).

---

## 13. Логирование (активации и PII)

| Место | Что логируется | Риск |
|--------|----------------|------|
| `src/app/login/actions.ts` 185–191 | user id, телефон, metadata | PII в логах хостинга |
| `src/lib/profile-sync.ts` 27 | user id + телефон | то же |
| `src/lib/auth/whatsapp-login.ts` 99–110 | user id / телефон | то же |
| `src/lib/analytics.ts` + вызовы из activate/admin | события активации, `phone_target`, хеш токена | БД analytics; частично PII |

Код **не** указывает отдельный «безопасный» sink логов — предполагается stdout/Vercel.

---

## 14. Дополнительные находки

### 14.1 Open redirect (потенциальный) в OAuth callback

**Файл:** `src/app/auth/callback/route.ts` (стр. 21–25, 33–34).

Проверка `next.startsWith('/')` **пропускает** строки вида `//host/...` (две косые после первого символа пути могут интерпретироваться как protocol-relative URL в некоторых сценариях редиректа).

**Риск:** **Open redirect** (CWE-601), фишинг после легитимного входа.

### 14.2 Коды redeem токена и платежа: `Math.random`

**Файл:** `src/app/app/redeem/[restaurantId]/[offerId]/actions.ts` (стр. 16–18, 185) — 6-значный код для `redeem_tokens`.

**Риск:** Пространство ~9×10⁵; при отсутствии brute-force/rate limit на уровне API — **перебор** кодов (зависит от политики Supabase/edge).

### 14.3 PIN персонала в открытом виде в выборке

**Файл:** `src/app/staff/redeem/actions.ts` (стр. 60–71) — `pin_code` сравнивается после чтения из БД.

**Риск:** Если таблица `staff_users` когда-либо доступна не тому роли или утекает бэкап — **PIN хранится не как slow-hash** в этом потоке (схема хранения в БД в репозитории не описана).

### 14.4 Логирование номера при несовпадении телефона активации

**Файл:** `src/app/activate/actions.ts` (стр. 60–71) — `meta: { userPhone }` в `logAnalyticsEvent`.

**Риск:** Сохранение телефона/идентификаторов в `analytics_events.meta` (jsonb).

---

## Итоговая сводка серьёзности (внутри репозитория)

| Уровень | Примеры |
|---------|---------|
| Критичный / высокий | Непроверяемый из git RLS для ключевых таблиц; публичный каталог vs миграция `restaurants` только для admin; подмена `userId` в `approvePaymentRequest`; PII в `console.log`. |
| Средний | Утечки `error.message` в API/страницах; open redirect в `auth/callback`; слабая энтропия `Math.random` для кодов; зависимости Next/flatted/picomatch (high). |
| Ниже | Отсутствие security headers в `next.config.ts`; дублирование проверки admin на странице платежей. |

---

*Документ сгенерирован по статическому анализу репозитория; поведение RLS на реальном инстансе Supabase требует проверки SQL в Dashboard или полного дампа политик.*
