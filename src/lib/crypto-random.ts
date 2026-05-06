import { randomBytes, randomInt } from 'node:crypto'

/** Платёжные коды формата KP-XXXXXX (6 цифр, криптостойкий randomInt). */
export function generatePaymentCode(): string {
  const num = randomInt(100_000, 1_000_000)
  return `KP-${num}`
}

/** 6-значный числовой код для redeem_tokens. */
export function generateRedeemCode(): string {
  return String(randomInt(100_000, 1_000_000))
}

export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex')
}
