-- redeem_tokens: сроки выдачи, одно продление, момент использования
ALTER TABLE public.redeem_tokens
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS extend_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS extended_once boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

UPDATE public.redeem_tokens
SET issued_at = COALESCE(issued_at, created_at, now())
WHERE issued_at IS NULL;

UPDATE public.redeem_tokens
SET extend_deadline_at = issued_at + interval '1 hour'
WHERE extend_deadline_at IS NULL;

UPDATE public.redeem_tokens
SET used_at = redeemed_at
WHERE used_at IS NULL AND redeemed_at IS NOT NULL;

ALTER TABLE public.redeem_tokens
  ALTER COLUMN issued_at SET DEFAULT now(),
  ALTER COLUMN issued_at SET NOT NULL,
  ALTER COLUMN extend_deadline_at SET NOT NULL;

-- staff_sessions: cookie-сессия персонала (7 дней), доступ только service role
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_sessions_token_hash_uidx
  ON public.staff_sessions (session_token_hash);

CREATE INDEX IF NOT EXISTS staff_sessions_restaurant_id_idx
  ON public.staff_sessions (restaurant_id);

CREATE INDEX IF NOT EXISTS staff_sessions_expires_at_idx
  ON public.staff_sessions (expires_at);

ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
