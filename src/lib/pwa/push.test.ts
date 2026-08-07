import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  PUSH_DISMISS_COOLDOWN_MS,
  PUSH_STORAGE,
  isPushDismissCooldownActive,
  setPushDismissCooldown,
} from '@/lib/pwa/push'

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

describe('push dismiss cooldown', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('hides card for 30 days', () => {
    setPushDismissCooldown(Date.now())
    expect(isPushDismissCooldownActive(Date.now())).toBe(true)
    expect(
      isPushDismissCooldownActive(Date.now() + PUSH_DISMISS_COOLDOWN_MS - 1),
    ).toBe(true)
    expect(
      isPushDismissCooldownActive(Date.now() + PUSH_DISMISS_COOLDOWN_MS + 1),
    ).toBe(false)
    expect(localStorage.getItem(PUSH_STORAGE.dismissUntil)).toBeTruthy()
  })
})
