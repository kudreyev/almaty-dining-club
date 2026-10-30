'use client'

import { trackGoal } from '@/lib/analytics-client'

/**
 * События PWA и push: Яндекс Метрика (цели), Facebook Pixel (trackCustom)
 * и analytics_events через /api/track.
 *
 * | Событие                              | Когда                                          | Параметры          |
 * |--------------------------------------|------------------------------------------------|--------------------|
 * | pwa_prompt_shown                     | Показали панель установки                      | trigger, platform  |
 * | pwa_prompt_accepted                  | «Установить» (Android: системный accepted)     | trigger, platform  |
 * | pwa_prompt_dismissed                 | «Не сейчас» / закрыли / отказ в системном окне | trigger, platform  |
 * | pwa_installed                        | appinstalled или первый запуск в standalone    | platform           |
 * | pwa_session                          | Каждый запуск в standalone (раз за сессию)     | —                  |
 * | inapp_browser_open_external_clicked  | «Открыть в браузере» во встроенном браузере    | platform           |
 * | push_softask_shown / _accepted       | Мягкий экран push показан / «Да, сообщать»     | trigger            |
 * | push_permission_granted / _denied    | Ответ на системный запрос                      | trigger            |
 * | push_received                        | Уведомление показано (пишет sw.js)             | campaign           |
 * | push_clicked                         | Клик по уведомлению                            | campaign           |
 */
export type PwaEvent =
  | 'pwa_prompt_shown'
  | 'pwa_prompt_accepted'
  | 'pwa_prompt_dismissed'
  | 'pwa_installed'
  | 'pwa_session'
  | 'inapp_browser_open_external_clicked'
  | 'push_softask_shown'
  | 'push_softask_accepted'
  | 'push_softask_dismissed'
  | 'push_permission_granted'
  | 'push_permission_denied'
  | 'push_clicked'

type Fbq = (action: string, event: string, params?: Record<string, unknown>) => void

export function trackPwa(event: PwaEvent, params?: Record<string, string | number | boolean | null>) {
  trackGoal(event, params ?? undefined)
  try {
    const fbq = (window as unknown as { fbq?: Fbq }).fbq
    if (typeof fbq === 'function') fbq('trackCustom', event, params ?? {})
  } catch {
    // аналитика не должна ломать UX
  }
}
