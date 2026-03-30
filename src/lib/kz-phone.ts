/**
 * KZ mobile: +7 + 10 digits. Display: +7 (7xx) xxx xxxx
 */

/** Внутренняя часть без кода страны (макс. 10 цифр). */
export function subscriberDigitsFromRaw(input: string): string {
  let d = input.replace(/\D/g, '').slice(0, 11)
  if (d.startsWith('8')) {
    d = ('7' + d.slice(1)).slice(0, 11)
  }
  if (d.length === 11 && d[0] === '7') {
    return d.slice(1)
  }
  if (d.length === 1 && d === '7') {
    return ''
  }
  return d.slice(0, 10)
}

export function formatKZPhone(input: string): string {
  const s = subscriberDigitsFromRaw(input)
  if (!s) return '+7'
  const a = s.slice(0, 3)
  const b = s.slice(3, 6)
  const c = s.slice(6, 10)
  let out = `+7 (${a}`
  if (s.length >= 3) {
    out += ')'
  }
  if (s.length > 3) {
    out += ` ${b}`
  }
  if (s.length > 6) {
    out += ` ${c}`
  }
  return out
}

/** Полный номер E.164 для KZ: +7 и 10 цифр абонента. */
export function normalizeKZPhone(input: string): string | null {
  const s = subscriberDigitsFromRaw(input)
  if (s.length !== 10) return null
  return `+7${s}`
}
