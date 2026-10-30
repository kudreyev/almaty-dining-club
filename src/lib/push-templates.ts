/**
 * Шаблоны push-уведомлений для админки (/admin/push) и Edge Function send-push.
 * Плейсхолдеры {name}, {offer}, {slug}, {city} подставляются через fillPushTemplate.
 */

export type PushTemplate = {
  id: string
  label: string
  title: string
  body: string
  url: string
}

export const PUSH_TEMPLATES: readonly PushTemplate[] = [
  {
    id: 'friday',
    label: 'Пятница: акция заведения',
    title: 'Пятница! 2 стейка по цене 1 в Антрекоте 🥩',
    body: 'Получите код в KudaClub и покажите официанту',
    url: '/r/entrecote',
  },
  {
    id: 'new_venue',
    label: 'Новое заведение',
    title: 'Новое в KudaClub: {name}, {offer}',
    body: 'Код — за 1 касание, покажите его официанту',
    url: '/r/{slug}',
  },
  {
    id: 'not_tried',
    label: 'Ещё не пробовали',
    title: 'Вы ещё не пробовали {offer} рядом с вами',
    body: 'Откройте каталог KudaClub и выберите на вечер',
    url: '/{city}',
  },
] as const

export function fillPushTemplate(text: string, vars: Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => vars[key]?.trim() || match)
}

export function hasUnfilledPlaceholders(text: string): boolean {
  return /\{\w+\}/.test(text)
}
