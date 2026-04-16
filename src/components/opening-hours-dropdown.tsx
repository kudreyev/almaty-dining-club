'use client'

import { useMemo, useState } from 'react'
import { WEEKDAY_LABELS_RU, formatHoursRange, type OpenStatus, type RestaurantHour } from '@/lib/opening-hours'

type OpeningHoursDropdownProps = {
  status: OpenStatus
  weekSchedule: RestaurantHour[]
}

function getCollapsedLabel(status: OpenStatus): string | null {
  if (status.labelDetail?.startsWith('Работает до ')) {
    return `Открыто до ${status.labelDetail.replace('Работает до ', '')}`
  }

  if (status.labelDetail?.startsWith('Откроется завтра в ')) {
    return `Закрыто до завтра ${status.labelDetail.replace('Откроется завтра в ', '')}`
  }

  const openingTodayMatch = status.labelDetail?.match(/^Откроется в (\d{2}:\d{2})$/)
  if (openingTodayMatch) {
    return `Закрыто до ${openingTodayMatch[1]}`
  }

  const openingLaterMatch = status.labelDetail?.match(/^Откроется в ([а-я]{2}) в (\d{2}:\d{2})$/i)
  if (openingLaterMatch) {
    return `Закрыто до ${openingLaterMatch[1]} ${openingLaterMatch[2]}`
  }

  if (status.labelShort === 'Открыто') {
    return 'Открыто'
  }

  return null
}

function ChevronDownIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`${className ?? ''} transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    >
      <path
        d="M5 7.5 10 12.5l5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function OpeningHoursDropdown({ status, weekSchedule }: OpeningHoursDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const collapsedLabel = getCollapsedLabel(status)
  const hoursByDay = useMemo(
    () => new Map(weekSchedule.map((item) => [item.day_of_week, item])),
    [weekSchedule]
  )

  if (!collapsedLabel && weekSchedule.length === 0) {
    return <div className="mt-4 text-sm text-gray-500">График не указан</div>
  }

  const toneClass = status.isOpen
    ? 'text-emerald-600'
    : collapsedLabel
      ? 'text-red-600'
      : 'text-gray-500'

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className={`flex w-full items-center justify-between gap-3 text-left ${toneClass}`}
      >
        <span className="text-base font-medium leading-6">{collapsedLabel ?? 'График не указан'}</span>
        <ChevronDownIcon expanded={isExpanded} className="h-5 w-5 shrink-0" />
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-1.5 text-sm leading-5 text-gray-600">
          {Array.from({ length: 7 }, (_, idx) => idx + 1).map((day) => (
            <p key={day}>
              <span className="font-medium text-gray-700">{WEEKDAY_LABELS_RU[day]}:</span>{' '}
              {formatHoursRange(hoursByDay.get(day))}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
