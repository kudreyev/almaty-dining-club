# PWA: долгоживущая сессия

Установленное PWA должно открываться в `/app/me` без OTP месяцами,
пока пользователь сам не нажмёт «Выйти».

## Что сделано в коде

- `persistSession: true`, `autoRefreshToken: true` в browser client
- cookie `maxAge` ~400 дней (`src/lib/supabase/auth-cookie-options.ts`)
- middleware вызывает `auth.getUser()` → обновляет refresh/access cookies
- `SessionKeepAlive` — refresh при focus / visibility + раз в 10 минут

## Что проверить в Supabase Dashboard

**Authentication → Sessions:**

| Настройка | Нужное значение |
|---|---|
| Time-box user sessions | **OFF** / пусто |
| Inactivity timeout | **OFF** / пусто |
| Access token expiry (JWT) | можно оставить 3600 с — клиент рефрешит |

Если включён time-box или inactivity (например 7 дней / 14 дней простоя),
код это **не обойдёт** — сессия умрёт на стороне Auth, и пуш откроет логин.
