import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  PWA_DISMISS_COOLDOWN_MS,
  PWA_STORAGE,
  isDismissCooldownActive,
  setDismissCooldown,
  incrementMeVisitCount,
  shouldOfferPwaInstall,
} from '@/lib/pwa/install'

function installMemoryLocalStorage() {
  const store = new Map<string, string>()
  const localStorageMock: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
  }
  vi.stubGlobal('localStorage', localStorageMock)
  vi.stubGlobal('window', { localStorage: localStorageMock })
}

describe('pwa install storage', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps dismiss cooldown for 14 days', () => {
    setDismissCooldown(Date.now())
    expect(isDismissCooldownActive(Date.now())).toBe(true)
    expect(
      isDismissCooldownActive(Date.now() + PWA_DISMISS_COOLDOWN_MS - 1000),
    ).toBe(true)
    expect(
      isDismissCooldownActive(Date.now() + PWA_DISMISS_COOLDOWN_MS + 1),
    ).toBe(false)
    expect(localStorage.getItem(PWA_STORAGE.dismissUntil)).toBeTruthy()
  })

  it('increments me visits from 1', () => {
    expect(incrementMeVisitCount()).toBe(1)
    expect(incrementMeVisitCount()).toBe(2)
    expect(incrementMeVisitCount()).toBe(3)
  })

  it('shouldOfferPwaInstall respects installed and cooldown', () => {
    expect(shouldOfferPwaInstall({ installed: false })).toBe(true)
    expect(shouldOfferPwaInstall({ installed: true })).toBe(false)
    setDismissCooldown(Date.now())
    expect(shouldOfferPwaInstall({ installed: false })).toBe(false)
  })
})
