'use client'

import { useRouter } from 'next/navigation'
import { CITIES, CITY_COOKIE, CITY_COOKIE_MAX_AGE, CITY_LABELS, type City } from '@/lib/cities'

function setCityCookie(city: City) {
  document.cookie = `${CITY_COOKIE}=${city}; path=/; max-age=${CITY_COOKIE_MAX_AGE}; samesite=lax`
}

export function CityLanding() {
  const router = useRouter()

  const choose = (city: City) => {
    setCityCookie(city)
    router.push(`/${city}`)
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-2xl flex-col items-center justify-center px-5 py-12 text-center">
      <div className="mb-2 text-2xl font-semibold tracking-tight text-neutral-900">
        Kuda<span style={{ color: '#D85A30' }}>club</span>
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
        Выберите город
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Покажем заведения и офферы в вашем городе. Подписка действует во всех городах.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => choose(city)}
            className="group flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center transition-all hover:border-accent hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400 transition-colors group-hover:text-accent"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="mt-3 text-lg font-semibold text-neutral-900">
              {CITY_LABELS[city]}
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}
