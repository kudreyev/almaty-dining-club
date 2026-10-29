import { CITY_COOKIE, CITY_COOKIE_MAX_AGE, CITY_HINT_COOKIE, type City } from '@/lib/cities'

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; samesite=lax`
}

/** Ручной выбор города: автоопределение по IP его больше не перебивает. */
export function rememberCity(city: City) {
  writeCookie(CITY_COOKIE, city, CITY_COOKIE_MAX_AGE)
  writeCookie(CITY_HINT_COOKIE, '', 0)
}
