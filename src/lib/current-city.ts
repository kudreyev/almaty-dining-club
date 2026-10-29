import { cookies, headers } from 'next/headers'
import {
  CITY_COOKIE,
  CITY_REQUEST_HEADER,
  DEFAULT_CITY,
  LEGACY_CITY_COOKIE,
  isCity,
  type City,
} from '@/lib/cities'

/**
 * Город текущего запроса: из пути страницы, выбранный вручную, по IP или Алматы.
 * Вычисляет middleware (заголовок x-kc-city); cookie — запасной вариант.
 */
export async function getCurrentCity(): Promise<City> {
  const fromMiddleware = (await headers()).get(CITY_REQUEST_HEADER)
  if (isCity(fromMiddleware)) return fromMiddleware
  return (await getManualCity()) ?? DEFAULT_CITY
}

/** Город, который пользователь выбрал сам (cookie kc_city). */
export async function getManualCity(): Promise<City | null> {
  const cookieStore = await cookies()
  const saved = cookieStore.get(CITY_COOKIE)?.value ?? cookieStore.get(LEGACY_CITY_COOKIE)?.value
  return isCity(saved) ? saved : null
}
