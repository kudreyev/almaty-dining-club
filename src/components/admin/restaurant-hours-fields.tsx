'use client'

import { useMemo, useState } from 'react'
import type { RestaurantHour } from '@/lib/opening-hours'

const DAY_ROWS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Пн' },
  { day: 2, label: 'Вт' },
  { day: 3, label: 'Ср' },
  { day: 4, label: 'Чт' },
  { day: 5, label: 'Пт' },
  { day: 6, label: 'Сб' },
  { day: 7, label: 'Вс' },
]

const DEFAULT_OPEN_TIME = '10:00'
const DEFAULT_CLOSE_TIME = '23:00'

function normalizeTimeForInput(value: string | null | undefined): string {
  if (!value) return ''
  const [hh, mm] = value.split(':')
  if (!hh || !mm) return ''
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
}

type Props = {
  initialHours?: RestaurantHour[]
}

type DayState = {
  openTime: string
  closeTime: string
  isClosed: boolean
  closeNextDay: boolean
}

function timeToMinutes(value: string): number {
  const [hh, mm] = value.split(':').map((part) => Number(part))
  return hh * 60 + mm
}

export function RestaurantHoursFields({ initialHours = [] }: Props) {
  const initialStateByDay = useMemo(() => {
    const map = new Map<number, DayState>()
    const hoursByDay = new Map(initialHours.map((item) => [item.day_of_week, item]))

    for (const { day } of DAY_ROWS) {
      const row = hoursByDay.get(day)
      map.set(day, {
        openTime: normalizeTimeForInput(row?.open_time) || DEFAULT_OPEN_TIME,
        closeTime: normalizeTimeForInput(row?.close_time) || DEFAULT_CLOSE_TIME,
        isClosed: Boolean(row?.is_closed),
        closeNextDay: Boolean(row?.close_next_day),
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

      const updated: DayState = { ...current, ...patch }

      if (!updated.isClosed && updated.openTime && updated.closeTime) {
        const openMinutes = timeToMinutes(updated.openTime)
        const closeMinutes = timeToMinutes(updated.closeTime)
        if (closeMinutes < openMinutes) {
          updated.closeNextDay = true
        }
      }

      next.set(day, updated)
      return next
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-base font-semibold text-gray-900">Режим работы</p>
      <p className="mt-1 text-sm text-gray-500">Для выходного включите чекбокс. Для ночного интервала включите «Закрытие на следующий день».</p>

      <div className="mt-4 space-y-3">
        {DAY_ROWS.map(({ day, label }) => {
          const row = hoursByDay.get(day)
          if (!row) return null

          return (
            <div key={day} className="grid items-center gap-3 rounded-lg border border-gray-100 p-3 sm:grid-cols-[56px_1fr_1fr_auto]">
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <input
                name={`hours_${day}_open_time`}
                type="time"
                value={row.openTime}
                onChange={(event) => updateDay(day, { openTime: event.target.value })}
                disabled={row.isClosed}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <input
                name={`hours_${day}_close_time`}
                type="time"
                value={row.closeTime}
                onChange={(event) => updateDay(day, { closeTime: event.target.value })}
                disabled={row.isClosed}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <div className="flex flex-col gap-1">
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    name={`hours_${day}_is_closed`}
                    checked={row.isClosed}
                    onChange={(event) => updateDay(day, { isClosed: event.target.checked })}
                    className="rounded"
                  />
                  выходной
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    name={`hours_${day}_close_next_day`}
                    checked={row.closeNextDay}
                    onChange={(event) => updateDay(day, { closeNextDay: event.target.checked })}
                    disabled={row.isClosed}
                    className="rounded"
                  />
                  Закрытие на следующий день
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
