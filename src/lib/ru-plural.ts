/**
 * Склонение слова «день» после числительного: «7 дней», «4 дня», «21 день».
 * Для 11–14 всегда «дней».
 */
export function ruDayWordAfterNumber(n: number): 'день' | 'дня' | 'дней' {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}

/**
 * Универсальное склонение русского существительного: [одна форма, две-четыре, пять-много].
 * Например: pluralize(1, ['заведение', 'заведения', 'заведений']) → 'заведение'.
 */
export function pluralizeRu(n: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return forms[2]
  if (mod10 === 1) return forms[0]
  if (mod10 >= 2 && mod10 <= 4) return forms[1]
  return forms[2]
}
