'use client'

import { useRouter } from 'next/navigation'
import { CITIES, CITY_COOKIE, CITY_COOKIE_MAX_AGE, CITY_LABELS, type City } from '@/lib/cities'

function setCityCookie(city: City) {
  document.cookie = `${CITY_COOKIE}=${city}; path=/; max-age=${CITY_COOKIE_MAX_AGE}; samesite=lax`
}

export function CitySelector({ current }: { current: City }) {
  const router = useRouter()

  const handleChange = (city: City) => {
    if (city === current) return
    setCityCookie(city)
    router.push(`/${city}`)
    router.refresh()
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Город</span>
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-2.5 text-gray-500"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value as City)}
        aria-label="Выбрать город"
        className="cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-7 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {CITIES.map((city) => (
          <option key={city} value={city}>
            {CITY_LABELS[city]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2 text-gray-400"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </label>
  )
}
