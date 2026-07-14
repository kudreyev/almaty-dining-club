'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listingVisibilityLabel } from '@/lib/labels'
import { CITIES, CITY_LABELS, isCity, type City } from '@/lib/cities'

export type AdminRestaurantRow = {
  id: string
  restaurant_name: string
  slug: string
  address: string | null
  is_active: boolean
  city: string
}

type CityFilter = 'all' | City
type StatusFilter = 'all' | 'active' | 'inactive'

export function AdminRestaurantsList({ restaurants }: { restaurants: AdminRestaurantRow[] }) {
  const [query, setQuery] = useState('')
  const [cityFilter, setCityFilter] = useState<CityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return restaurants.filter((r) => {
      if (cityFilter !== 'all' && r.city !== cityFilter) return false

      if (statusFilter === 'active' && !r.is_active) return false
      if (statusFilter === 'inactive' && r.is_active) return false

      if (normalizedQuery) {
        const haystack = [r.restaurant_name, r.slug, r.address ?? '']
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(normalizedQuery)) return false
      }

      return true
    })
  }, [restaurants, query, cityFilter, statusFilter])

  const selectClass =
    'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition-colors focus:border-accent'

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: название, slug или адрес"
          className="w-full flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
        />
        <div className="flex gap-3">
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Фильтр по статусу"
            className={selectClass}
          >
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Скрытые</option>
          </select>
        </div>
      </div>

      <p className="mb-3 text-sm text-gray-500">
        Найдено: {filtered.length} из {restaurants.length}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Ничего не найдено. Измените параметры поиска.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} padding="sm" hover>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{r.restaurant_name}</p>
                    <Badge color="accent">
                      {isCity(r.city) ? CITY_LABELS[r.city] : r.city}
                    </Badge>
                    <Badge color={r.is_active ? 'green' : 'default'}>
                      {listingVisibilityLabel(!!r.is_active)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-400">
                    {(r.address ?? 'Адрес не указан')} · /{r.slug}
                  </p>
                </div>
                <Button href={`/admin/restaurants/${r.id}/edit`} variant="secondary" size="sm">
                  Изменить
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
