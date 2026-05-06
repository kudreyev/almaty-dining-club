import { safeLog } from '@/lib/safe-logger'

const isProduction = process.env.NODE_ENV === 'production'

const FALLBACK_DEFAULT = 'Что-то пошло не так. Напишите нам в WhatsApp.'

/** Контексты для пользовательских сообщений (без деталей БД). */
export function getFallbackByContext(context: string): string {
  const messages: Record<string, string> = {
    auth: 'Ошибка авторизации. Попробуйте войти заново.',
    'payment-request': 'Не удалось отправить заявку. Попробуйте позже.',
    subscription: 'Ошибка с подпиской. Напишите нам в WhatsApp.',
    'photo-upload': 'Не удалось загрузить фото. Попробуйте ещё раз.',
    redeem: 'Ошибка активации оффера. Покажите официанту этот экран.',
    offers: 'Не удалось загрузить офферы.',
    restaurants: 'Не удалось загрузить список заведений.',
    'staff-history': 'Не удалось загрузить историю.',
    map: 'Не удалось загрузить карту.',
    payments: 'Не удалось загрузить заявки.',
    import: 'Ошибка импорта. Проверьте данные и попробуйте снова.',
    'transfer-subscription': 'Не удалось перенести подписку. Напишите в поддержку.',
    staff: 'Ошибка входа. Попробуйте ещё раз или обратитесь в поддержку.',
  }
  return messages[context] ?? FALLBACK_DEFAULT
}

export function getUserFacingError(
  error: unknown,
  fallback: string = FALLBACK_DEFAULT
): string {
  if (isProduction) {
    return fallback
  }

  if (error instanceof Error) {
    return `[DEV] ${error.message}`
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return `[DEV] ${(error as { message: string }).message}`
  }

  return fallback
}

export function logServerError(context: string, error: unknown): void {
  safeLog.error(`[${context}]`, error)
}

export function handleActionError(
  error: unknown,
  context: string
): { ok: false; error: string } {
  logServerError(context, error)
  return {
    ok: false,
    error: getUserFacingError(error, getFallbackByContext(context)),
  }
}
