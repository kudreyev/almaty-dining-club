/**
 * Разрешает только "+" и цифры.
 * Плюс может быть только в начале.
 */
export function sanitizePhoneInput(input: string): string {
  const cleaned = input.replace(/[^\d+]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\+/g, '')}`
  }
  return cleaned.replace(/\+/g, '')
}

/**
 * Нормализация к E.164-like.
 * Возвращает +<digits> или null, если номер слишком короткий.
 *
 * KZ распознаётся как:
 * - +7XXXXXXXXXX
 * - 8XXXXXXXXXX -> +7XXXXXXXXXX
 * - 7XXXXXXXXXX -> +7XXXXXXXXXX
 */
export function normalizeToE164Like(input: string): string | null {
  const raw = sanitizePhoneInput(input.trim())
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) {
    if (digits.length < 8) return null
    return `+${digits}`
  }

  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7${digits.slice(1)}`
  }

  if (digits.length < 8) return null
  return `+${digits}`
}

export function isKZNumber(e164: string): boolean {
  return /^\+7\d{10}$/.test(e164)
}

/**
 * digits11: строка из 11 цифр, начиная с 7.
 * Пример: 77001234567 -> +7 (700) 123 4567
 */
export function formatKZPhoneFromDigits(digits11: string): string {
  if (!/^\d{11}$/.test(digits11) || !digits11.startsWith('7')) {
    return `+${digits11.replace(/\D/g, '')}`
  }

  const s = digits11.slice(1)
  const a = s.slice(0, 3)
  const b = s.slice(3, 6)
  const c = s.slice(6, 10)
  return `+7 (${a}) ${b} ${c}`
}

export function formatPhoneForDisplay(input: string): string {
  const normalized = normalizeToE164Like(input)
  if (!normalized) return sanitizePhoneInput(input)
  if (isKZNumber(normalized)) {
    return formatKZPhoneFromDigits(normalized.slice(1))
  }
  return normalized
}

/** Backward compatibility for existing imports. */
export function subscriberDigitsFromRaw(input: string): string {
  return sanitizePhoneInput(input)
}

/** Backward compatibility for existing imports. */
export function formatKZPhone(input: string): string {
  const normalized = normalizeToE164Like(input)
  if (!normalized || !isKZNumber(normalized)) return sanitizePhoneInput(input)
  return formatKZPhoneFromDigits(normalized.slice(1))
}

/** Backward compatibility for existing imports. */
export function normalizeKZPhone(input: string): string | null {
  const normalized = normalizeToE164Like(input)
  if (!normalized || !isKZNumber(normalized)) return null
  return normalized
}
