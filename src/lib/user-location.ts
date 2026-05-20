'use client'

import { useEffect, useState } from 'react'

const USER_LOCATION_STORAGE_KEY = 'kudaclub_user_location'
const LEGACY_USER_LOCATION_STORAGE_KEY = 'kp:userLocation'
const USER_LOCATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const LOCATION_UPDATED_EVENT = 'kudaclub:user-location-updated'

export type UserLocation = { lat: number; lng: number }

export type GeoPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied'

export type GeoRequestResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; permissionDenied: boolean }

export function getStoredUserLocation(): UserLocation | null {
  if (typeof window === 'undefined') return null

  const raw =
    window.localStorage.getItem(USER_LOCATION_STORAGE_KEY)
    ?? window.localStorage.getItem(LEGACY_USER_LOCATION_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number; ts?: number }
    if (
      typeof parsed.lat !== 'number'
      || typeof parsed.lng !== 'number'
      || !Number.isFinite(parsed.lat)
      || !Number.isFinite(parsed.lng)
    ) {
      return null
    }
    if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > USER_LOCATION_MAX_AGE_MS) {
      return null
    }
    return { lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}

export function persistUserLocation(lat: number, lng: number): void {
  if (typeof window === 'undefined') return
  const payload = JSON.stringify({ lat, lng, ts: Date.now() })
  window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, payload)
  window.localStorage.setItem(LEGACY_USER_LOCATION_STORAGE_KEY, payload)
  // Уведомляем подписчиков внутри той же вкладки.
  window.dispatchEvent(
    new CustomEvent<UserLocation>(LOCATION_UPDATED_EVENT, { detail: { lat, lng } })
  )
}

export async function getStoredGeolocationPermissionState(): Promise<GeoPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown'
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    if (status.state === 'denied') return 'denied'
    if (status.state === 'granted') return 'granted'
    return 'prompt'
  } catch {
    return 'unknown'
  }
}

export function requestUserPosition(): Promise<GeoRequestResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, permissionDenied: false })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (err) => {
        resolve({ ok: false, permissionDenied: err?.code === 1 })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    )
  })
}

/**
 * Запрашивает геолокацию у пользователя и сохраняет её в localStorage.
 * Должен вызываться только из явных действий (клик «По близости», заход на /map),
 * не из автоматических эффектов на чтении.
 */
export async function requestAndPersistUserLocation(): Promise<GeoRequestResult> {
  const result = await requestUserPosition()
  if (result.ok) {
    persistUserLocation(result.lat, result.lng)
  }
  return result
}

/**
 * Реактивно отдаёт сохранённую локацию пользователя.
 * Никаких запросов разрешения не делает.
 */
export function useUserLocation(): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(null)

  useEffect(() => {
    setLocation(getStoredUserLocation())

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<UserLocation>).detail
      if (detail && Number.isFinite(detail.lat) && Number.isFinite(detail.lng)) {
        setLocation({ lat: detail.lat, lng: detail.lng })
      } else {
        setLocation(getStoredUserLocation())
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === USER_LOCATION_STORAGE_KEY
        || e.key === LEGACY_USER_LOCATION_STORAGE_KEY
      ) {
        setLocation(getStoredUserLocation())
      }
    }

    window.addEventListener(LOCATION_UPDATED_EVENT, onCustom as EventListener)
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener(LOCATION_UPDATED_EVENT, onCustom as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return location
}
