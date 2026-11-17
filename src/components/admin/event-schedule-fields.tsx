'use client'

import { useState } from 'react'
import { WEEKDAY_LABELS_RU } from '@/lib/opening-hours'

export type ScheduleDayState = {
  closed: boolean
  open: string
  close: string
  open2: string
  close2: string
}

const EMPTY: ScheduleDayState = {
  closed: true,
  open: '08:00',
  close: '12:00',
  open2: '',
  close2: '',
}

type Props = {
  initial?: Partial<Record<number, ScheduleDayState>>
}

export function EventScheduleFields({ initial = {} }: Props) {
  const [days, setDays] = useState<Record<number, ScheduleDayState>>(() => {
    const next: Record<number, ScheduleDayState> = {}
    for (let d = 1; d <= 7; d += 1) {
      next[d] = { ...EMPTY, ...(initial[d] ?? {}) }
    }
    return next
  })

  function update(day: number, patch: Partial<ScheduleDayState>) {
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  function copyWeekdays() {
    const template = days[1]
    setDays((prev) => {
      const next = { ...prev }
      for (let d = 1; d <= 5; d += 1) next[d] = { ...template }
      return next
    })
  }

  function copyAll() {
    const template = days[1]
    setDays((prev) => {
      const next = { ...prev }
      for (let d = 1; d <= 7; d += 1) next[d] = { ...template }
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyWeekdays}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Скопировать на будни
        </button>
        <button
          type="button"
          onClick={copyAll}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Скопировать на все дни
        </button>
      </div>

      {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
        const state = days[day]
        return (
          <div key={day} className="rounded-xl border border-gray-200 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-8 text-sm font-medium">{WEEKDAY_LABELS_RU[day]}</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={state.closed}
                  onChange={(e) => update(day, { closed: e.target.checked })}
                  className="rounded"
                />
                не подают
              </label>
              {state.closed ? (
                <input type="hidden" name={`sched_${day}_closed`} value="on" />
              ) : (
                <>
                  <input
                    type="time"
                    name={`sched_${day}_open`}
                    value={state.open}
                    onChange={(e) => update(day, { open: e.target.value })}
                    className="rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-gray-400">—</span>
                  <input
                    type="time"
                    name={`sched_${day}_close`}
                    value={state.close}
                    onChange={(e) => update(day, { close: e.target.value })}
                    className="rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                  <input
                    type="time"
                    name={`sched_${day}_open2`}
                    value={state.open2}
                    onChange={(e) => update(day, { open2: e.target.value })}
                    className="rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                  <input
                    type="time"
                    name={`sched_${day}_close2`}
                    value={state.close2}
                    onChange={(e) => update(day, { close2: e.target.value })}
                    className="rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
