'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { staffPinStatusLabel } from '@/lib/labels'
import { CITIES, CITY_LABELS, isCity, type City } from '@/lib/cities'
import { upsertRestaurantStaff } from '@/app/admin/staff/actions'

export type StaffRestaurantRow = {
  id: string
  restaurant_name: string
  city: string
}

export type StaffRow = {
  id: string
  restaurant_id: string
  staff_name: string
  pin_code: string
  is_active: boolean
}

type CityFilter = 'all' | City
type PinFilter = 'all' | 'with_pin' | 'without_pin'

const selectClass =
  'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition-colors focus:border-accent'

export function StaffRestaurantList({
  restaurants,
  staff,
}: {
  restaurants: StaffRestaurantRow[]
  staff: StaffRow[]
}) {
  const [query, setQuery] = useState('')
  const [cityFilter, setCityFilter] = useState<CityFilter>('all')
  const [pinFilter, setPinFilter] = useState<PinFilter>('all')

  const staffByRestaurant = useMemo(() => {
    const map = new Map<string, StaffRow>()
    staff.forEach((s) => map.set(s.restaurant_id, s))
    return map
  }, [staff])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return restaurants.filter((r) => {
      if (cityFilter !== 'all' && r.city !== cityFilter) return false

      const hasPin = staffByRestaurant.has(r.id)
      if (pinFilter === 'with_pin' && !hasPin) return false
      if (pinFilter === 'without_pin' && hasPin) return false

      if (normalizedQuery && !r.restaurant_name.toLowerCase().includes(normalizedQuery)) {
        return false
      }
      return true
    })
  }, [restaurants, query, cityFilter, pinFilter, staffByRestaurant])

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
            value={pinFilter}
            onChange={(e) => setPinFilter(e.target.value as PinFilter)}
            aria-label="Фильтр по PIN"
            className={selectClass}
          >
            <option value="all">Все</option>
            <option value="with_pin">PIN настроен</option>
            <option value="without_pin">PIN не задан</option>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r) => {
            const staffRow = staffByRestaurant.get(r.id)
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{r.restaurant_name}</p>
                      <Badge color="accent">
                        {isCity(r.city) ? CITY_LABELS[r.city] : r.city}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-400">
                      {staffRow ? 'PIN настроен' : 'PIN не задан'}
                    </p>
                  </div>
                  <Badge color={staffRow?.is_active ? 'green' : 'default'}>
                    {staffRow ? staffPinStatusLabel(!!staffRow.is_active) : 'Не задан'}
                  </Badge>
                </div>

                <form action={upsertRestaurantStaff} className="mt-4 space-y-3">
                  <input type="hidden" name="restaurant_id" value={r.id} />
                  <Input
                    name="staff_name"
                    defaultValue={staffRow?.staff_name ?? 'Администратор'}
                    placeholder="Имя в системе"
                  />
                  <Input
                    name="pin_code"
                    defaultValue={staffRow?.pin_code ?? ''}
                    placeholder="PIN (4 цифры)"
                    required
                  />
                  <label className="flex items-center gap-2 text-base text-gray-600">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={staffRow ? staffRow.is_active : true}
                      className="rounded"
                    />
                    Активен
                  </label>
                  <Button type="submit" size="sm" className="w-full">
                    Сохранить
                  </Button>
                </form>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
