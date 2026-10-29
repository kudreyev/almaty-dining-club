import { pluralizeRu } from '@/lib/ru-plural'

const NBSP = '\u00A0'

/** 359370 → «359 370». Пробел неразрывный, чтобы число не переносилось. */
export function formatThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/**
 * «359 370 ₸», от миллиона — «1,2 млн ₸». scale — значение, по которому выбирается
 * формат: при анимации к итоговой сумме промежуточные числа пишутся так же, как итог.
 */
export function formatSavingsKzt(n: number, scale = n): string {
  if (scale >= 1_000_000) {
    const millions = (Math.floor(n / 100_000) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',')
    return `${millions}${NBSP}млн${NBSP}₸`
  }
  return `${formatThousands(n)}${NBSP}₸`
}

/** «57 гостей и 93 ужина и кофе по 1+1». */
export function formatSavingsDetails(guests: number, redemptions: number): string {
  const guestsWord = pluralizeRu(guests, ['гость', 'гостя', 'гостей'])
  const mealsWord = pluralizeRu(redemptions, ['ужин', 'ужина', 'ужинов'])
  return `${formatThousands(guests)} ${guestsWord} и ${formatThousands(redemptions)} ${mealsWord} и кофе по${NBSP}1+1`
}
