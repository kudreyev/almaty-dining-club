'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CITIES, CITY_LABELS, isCity, type City } from '@/lib/cities'

export type OffersRestaurantRow = {
  id: string
  restaurant_name: string
  city: string
}

type CityFilter = 'all' | City

const selectClass =
  'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition-colors focus:border-accent'

export function OffersRestaurantList({ restaurants }: { restaurants: OffersRestaurantRow[] }) {
  const [query, setQuery] = useState('')
  const [cityFilter, setCityFilter] = useState<CityFilter>('all')

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return restaurants.filter((r) => {
      if (cityFilter !== 'all' && r.city !== cityFilter) return false
      if (normalizedQuery && !r.restaurant_name.toLowerCase().includes(normalizedQuery)) {
        return false
      }
      return true
    })
  }, [restaurants, query, cityFilter])

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию"
          className="w-full flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
        />
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value as CityFilter)}
          aria-label="Фильтр по городу"
          className={selectClass}
        >
          <option value="all">Все города</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {CITY_LABELS[city]}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-sm text-gray-500">
        Найдено: {filtered.length} из {restaurants.length}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Ничего не найдено. Измените параметры поиска.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Link key={r.id} href={`/admin/offers/${r.id}`}>
              <Card hover padding="md" className="h-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{r.restaurant_name}</p>
                  <Badge color="accent">
                    {isCity(r.city) ? CITY_LABELS[r.city] : r.city}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-400">Управлять офферами →</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
