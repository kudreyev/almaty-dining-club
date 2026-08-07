/** Badging API: новые заведения с последнего визита. */

export const VENUE_SEEN_STORAGE_KEY = 'kudaclub:venues_seen_at'

export function readVenuesSeenAt(): string | null {
  try {
    return window.localStorage.getItem(VENUE_SEEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function markVenuesSeen(iso = new Date().toISOString()): void {
  try {
    window.localStorage.setItem(VENUE_SEEN_STORAGE_KEY, iso)
  } catch {
    // ignore
  }
}

export async function setAppBadgeSafe(count: number): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (count <= 0) {
      if (typeof nav.clearAppBadge === 'function') await nav.clearAppBadge()
      return
    }
    if (typeof nav.setAppBadge === 'function') await nav.setAppBadge(count)
  } catch {
    // unsupported / permission
  }
}

export async function clearAppBadgeSafe(): Promise<void> {
  await setAppBadgeSafe(0)
}
