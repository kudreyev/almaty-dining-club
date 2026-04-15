'use client'

import { useState } from 'react'
import { WEEKDAY_LABELS_RU, formatHoursRange, type OpenStatus, type RestaurantHour } from '@/lib/opening-hours'

type RestaurantHoursCardProps = {
  openStatus: OpenStatus
  hoursForWeek: RestaurantHour[]
}

export function RestaurantHoursCard({ openStatus, hoursForWeek }: RestaurantHoursCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hoursByDay = new Map(hoursForWeek.map((item) => [item.day_of_week, item]))

  return (
    <div className="mt-6 rounded-xl bg-gray-50 p-4">
      <p className="text-sm font-medium uppercase tracking-wider text-gray-400">Режим работы</p>
      <p className={`mt-2 text-base font-medium ${openStatus.isOpen ? 'text-emerald-700' : 'text-gray-700'}`}>
        {openStatus.labelShort}
      </p>
      {openStatus.labelDetail ? <p className="mt-1 text-sm text-gray-500">{openStatus.labelDetail}</p> : null}

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="mt-3 text-sm font-medium text-gray-700 underline underline-offset-2 transition-colors hover:text-gray-900"
      >
        {isExpanded ? 'Скрыть график' : 'Показать весь график'}
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          {Array.from({ length: 7 }, (_, idx) => idx + 1).map((day) => (
            <p key={day}>
              <span className="font-medium text-gray-700">{WEEKDAY_LABELS_RU[day]}:</span>{' '}
              {formatHoursRange(hoursByDay.get(day))}
              {hoursByDay.get(day)?.close_next_day ? (
                <span className="text-xs text-gray-400"> (на следующий день)</span>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
