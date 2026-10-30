import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROMPT_STATE,
  INSTALL_PROMPT_PAUSE_DAYS,
  androidChromeIntentUrl,
  canAutoShowInstallPrompt,
  canShowPushSoftAsk,
  detectInstallPlatform,
  isRepeatVisitWithin7Days,
  mergePromptState,
  registerVisit,
} from '@/lib/pwa/install'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1',
  iphoneChromeOld:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/108.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,3; iOS 18_1; ru_RU)',
  ipadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  androidInstagram:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android',
  androidTikTok:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 trill_350 musical_ly_350 BytedanceWebview/d8a21c6',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
}

describe('detectInstallPlatform', () => {
  it('recognises each platform from the matrix', () => {
    expect(detectInstallPlatform({ ua: UA.iphoneSafari, standalone: false })).toBe('ios-safari')
    expect(detectInstallPlatform({ ua: UA.iphoneChrome, standalone: false })).toBe('ios-other')
    expect(detectInstallPlatform({ ua: UA.iphoneChromeOld, standalone: false })).toBe('unsupported')
    expect(detectInstallPlatform({ ua: UA.iphoneInstagram, standalone: false })).toBe('inapp-ios')
    expect(detectInstallPlatform({ ua: UA.ipadAsMac, standalone: false, maxTouchPoints: 5 })).toBe('ios-safari')
    expect(detectInstallPlatform({ ua: UA.androidChrome, standalone: false })).toBe('android')
    expect(detectInstallPlatform({ ua: UA.androidInstagram, standalone: false })).toBe('inapp-android')
    expect(detectInstallPlatform({ ua: UA.androidTikTok, standalone: false })).toBe('inapp-android')
    expect(detectInstallPlatform({ ua: UA.desktopChrome, standalone: false })).toBe('desktop')
  })

  it('standalone wins over everything', () => {
    expect(detectInstallPlatform({ ua: UA.iphoneSafari, standalone: true })).toBe('standalone')
  })
})

describe('install prompt frequency', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  const day = 24 * 60 * 60 * 1000

  it('pauses for 14 days after «Не сейчас» and stops after 3 shows', () => {
    expect(canAutoShowInstallPrompt(EMPTY_PROMPT_STATE, now)).toBe(true)
    const dismissed = { shownCount: 1, dismissedAt: now, installed: false }
    expect(canAutoShowInstallPrompt(dismissed, now + 13 * day)).toBe(false)
    expect(canAutoShowInstallPrompt(dismissed, now + INSTALL_PROMPT_PAUSE_DAYS * day)).toBe(true)
    expect(canAutoShowInstallPrompt({ shownCount: 3, dismissedAt: null, installed: false }, now)).toBe(false)
    expect(canAutoShowInstallPrompt({ shownCount: 0, dismissedAt: null, installed: true }, now)).toBe(false)
  })

  it('merges local and profile state strictly', () => {
    const merged = mergePromptState(
      { shownCount: 1, dismissedAt: now - 20 * day, installed: false },
      { shownCount: 2, dismissedAt: now - day, installed: false },
    )
    expect(merged).toEqual({ shownCount: 2, dismissedAt: now - day, installed: false })
    expect(mergePromptState(EMPTY_PROMPT_STATE, null)).toEqual(EMPTY_PROMPT_STATE)
  })
})

describe('visits', () => {
  const t0 = Date.parse('2026-10-30T12:00:00Z')
  it('counts a new visit only after 30 minutes of inactivity', () => {
    let visits = registerVisit([], t0)
    visits = registerVisit(visits, t0 + 10 * 60 * 1000)
    expect(visits).toHaveLength(1)
    expect(isRepeatVisitWithin7Days(visits, t0 + 10 * 60 * 1000)).toBe(false)
    visits = registerVisit(visits, t0 + 2 * 24 * 60 * 60 * 1000)
    expect(isRepeatVisitWithin7Days(visits, t0 + 2 * 24 * 60 * 60 * 1000)).toBe(true)
  })

  it('ignores visits older than 7 days', () => {
    const now = t0 + 8 * 24 * 60 * 60 * 1000
    expect(isRepeatVisitWithin7Days(registerVisit([t0], now), now)).toBe(false)
  })
})

describe('push soft ask', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  const base = { supported: true, permission: 'default' as const, dismissedAt: null, redeemedOnce: false, now }

  it('iPhone only inside the installed app, Android after the first redeemed code', () => {
    expect(canShowPushSoftAsk({ ...base, platform: 'ios-safari' })).toBe(false)
    expect(canShowPushSoftAsk({ ...base, platform: 'standalone' })).toBe(true)
    expect(canShowPushSoftAsk({ ...base, platform: 'android' })).toBe(false)
    expect(canShowPushSoftAsk({ ...base, platform: 'android', redeemedOnce: true })).toBe(true)
  })

  it('never after a system «denied» and not for 30 days after «Не надо»', () => {
    expect(canShowPushSoftAsk({ ...base, platform: 'standalone', permission: 'denied' })).toBe(false)
    expect(canShowPushSoftAsk({ ...base, platform: 'standalone', dismissedAt: now - 29 * 86400000 })).toBe(false)
    expect(canShowPushSoftAsk({ ...base, platform: 'standalone', dismissedAt: now - 31 * 86400000 })).toBe(true)
  })
})

describe('androidChromeIntentUrl', () => {
  it('keeps path and query', () => {
    expect(androidChromeIntentUrl('https://kudaclub.kz/app/redeem/a/b?x=1')).toBe(
      'intent://kudaclub.kz/app/redeem/a/b?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fkudaclub.kz%2Fapp%2Fredeem%2Fa%2Fb%3Fx%3D1;end',
    )
  })
})
