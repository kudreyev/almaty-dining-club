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

export function RestaurantHoursFields({ initialHours = [] }: Props) {
  const hoursByDay = new Map(initialHours.map((item) => [item.day_of_week, item]))

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-base font-semibold text-gray-900">Режим работы</p>
      <p className="mt-1 text-sm text-gray-500">Для выходного включите чекбокс. Ночные интервалы пока не поддерживаются.</p>

      <div className="mt-4 space-y-3">
        {DAY_ROWS.map(({ day, label }) => {
          const row = hoursByDay.get(day)
          const openTime = normalizeTimeForInput(row?.open_time) || DEFAULT_OPEN_TIME
          const closeTime = normalizeTimeForInput(row?.close_time) || DEFAULT_CLOSE_TIME

          return (
            <div key={day} className="grid items-center gap-3 rounded-lg border border-gray-100 p-3 sm:grid-cols-[56px_1fr_1fr_auto]">
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <input
                name={`hours_${day}_open_time`}
                type="time"
                defaultValue={openTime}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <input
                name={`hours_${day}_close_time`}
                type="time"
                defaultValue={closeTime}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  name={`hours_${day}_is_closed`}
                  defaultChecked={Boolean(row?.is_closed)}
                  className="rounded"
                />
                выходной
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
