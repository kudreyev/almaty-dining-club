# Публичная схема БД (обзор для security review)

Источник правды для структуры и политик: `supabase/migrations/20260320120000_baseline_public_schema.sql` и последующие миграции.

**Важно:** baseline восстановлен из кода и исторических миграций, не из `pg_dump` продакшена. Перед релизом сверьте политики в Supabase Dashboard с файлом миграций.

**service_role:** обходит RLS целиком; в колонке отмечено **bypass**, если для JWT-ролей политики не дают полного CRUD и фактические операции идут с сервера через service key.

| Таблица | RLS | anon SELECT | auth SELECT | auth UPDATE | service_role |
|--------|-----|-------------|-------------|-------------|--------------|
| profiles | on | — | own | own | bypass; admin — политика `profiles_admin_all` (все операции через JWT admin) |
| restaurants | on | активные | admin — все | admin | bypass |
| restaurant_hours | on | активный ресторан | admin — все | admin | bypass |
| restaurant_locations | on | активный ресторан | admin — все | admin | bypass |
| restaurant_photos | on | активное фото | admin — все | admin | bypass |
| offers | on | активные офферы | admin — все | admin | bypass |
| subscriptions | on | — | own | — | **bypass** (апрув/трансфер в коде через admin client) |
| payment_requests | on | — | own + admin | admin | bypass |
| payment_admin_audit | on | — | — | — | только insert/read через **bypass** (политик нет) |
| activation_links | on | — | admin | admin | bypass |
| analytics_events | on | — | admin | admin | **bypass** (серверные вставки) |
| subscribers | on | — | admin | — | **bypass** (TipTop webhooks) |
| payments | on | — | admin | — | **bypass** (TipTop webhooks) |
| daily_ad_stats | on | — | admin | — | **bypass** (cron ad-stats) |
| redeem_tokens | on | — | own | own + **anon UPDATE (true)** | bypass |
| redemptions | on | — | own + admin | admin | bypass; **anon INSERT (true)** |
| staff_users | on | **все is_active=true (вкл. PIN)** | admin | admin | bypass |
| staff_sessions | on | — | — | — | только **bypass** |
| redeem_rate_failures | on | — | — | — | только **bypass** |
| redeem_rate_blocks | on | — | — | — | только **bypass** |

Детализация по INSERT/DELETE и исключениям — в комментариях к миграции и в разделе ниже.

## Риски (проверка п. 3)

1. **`redeem_tokens` / `redemptions`:** для роли `anon` заданы широкие правила (`UPDATE` / `INSERT` без привязки к сессии персонала), потому что сценарий staff использует anon-ключ. Риск: при обходе приложения возможна злоупотребляемая запись/обновление — усиление: RPC `SECURITY DEFINER`, Edge Function или единый **service_role** на сервере.

2. **`staff_users`:** SELECT для `public`/`anon` по `is_active` отдаёт строки персонала (включая PIN) при неограниченном запросе; безопасность опирается на фильтры в коде и rate limit.

3. **`public.is_profile_admin(uuid)`:** `SECURITY DEFINER`, чтобы проверки админа не упирались в рекурсию RLS на `profiles`.

4. **Прод:** сверить список политик в Dashboard с репозиторием после деплоя миграций.

## Дамп с прода / локальный snapshot

```bash
supabase link --project-ref <ref>
supabase db dump --schema public -f current-schema.sql
```

В этом окружении CLI `supabase` отсутствует — актуальный текст «как дамп» см. в начале `supabase/migrations/20260320120000_baseline_public_schema.sql` (комментарий + DDL).
