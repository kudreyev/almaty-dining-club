'use client'

import { useMemo, useState } from 'react'
import type { OfferUsableHour } from '@/lib/offers'

const DAY_ROWS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Пн' },
  { day: 2, label: 'Вт' },
  { day: 3, label: 'Ср' },
  { day: 4, label: 'Чт' },
  { day: 5, label: 'Пт' },
  { day: 6, label: 'Сб' },
  { day: 7, label: 'Вс' },
]

function normalizeTimeForInput(value: string | null | undefined): string {
  if (!value) return ''
  const [hh, mm] = value.split(':')
  if (!hh || !mm) return ''
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
}

type Props = {
  initialHours?: OfferUsableHour[]
}

type DayState = {
  fromTime: string
  toTime: string
  isUnavailable: boolean
}

export function OfferUsableHoursFields({ initialHours = [] }: Props) {
  const initialStateByDay = useMemo(() => {
    const map = new Map<number, DayState>()
    const hoursByDay = new Map(initialHours.map((item) => [item.day_of_week, item]))

    for (const { day } of DAY_ROWS) {
      const row = hoursByDay.get(day)
      map.set(day, {
        fromTime: normalizeTimeForInput(row?.from_time),
        toTime: normalizeTimeForInput(row?.to_time),
        isUnavailable: Boolean(row?.is_unavailable),
      })
    }

    return map
  }, [initialHours])

  const [hoursByDay, setHoursByDay] = useState<Map<number, DayState>>(initialStateByDay)

  function updateDay(day: number, patch: Partial<DayState>) {
    setHoursByDay((prev) => {
      const next = new Map(prev)
      const current = next.get(day)
      if (!current) return prev
      next.set(day, { ...current, ...patch })
      return next
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-base font-semibold text-gray-900">Расписание использования</p>
      <p className="mt-1 text-sm text-gray-500">
        Только для Kudafest. Укажите часы по дням или оставьте пустым — тогда сет доступен весь день.
        Для выходного включите «недоступен».
      </p>

      <div className="mt-4 space-y-3">
        {DAY_ROWS.map(({ day, label }) => {
          const row = hoursByDay.get(day)
          if (!row) return null

          return (
            <div
              key={day}
              className="grid items-center gap-3 rounded-lg border border-gray-100 p-3 sm:grid-cols-[56px_1fr_1fr_auto]"
            >
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <input
                name={`offer_hours_${day}_from_time`}
                type="time"
                value={row.fromTime}
                onChange={(event) => updateDay(day, { fromTime: event.target.value })}
                disabled={row.isUnavailable}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <input
                name={`offer_hours_${day}_to_time`}
                type="time"
                value={row.toTime}
                onChange={(event) => updateDay(day, { toTime: event.target.value })}
                disabled={row.isUnavailable}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  name={`offer_hours_${day}_is_unavailable`}
                  checked={row.isUnavailable}
                  onChange={(event) => updateDay(day, { isUnavailable: event.target.checked })}
                  className="rounded"
                />
                недоступен
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
