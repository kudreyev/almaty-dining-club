'use client'

import { useRouter } from 'next/navigation'

export function WeekPicker({ weeks, current }: { weeks: string[]; current: string }) {
  const router = useRouter()
  const options = weeks.includes(current) ? weeks : [current, ...weeks]

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      Неделя
      <select
        value={current}
        onChange={(event) => router.push(`/admin/report?week=${event.target.value}`)}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
      >
        {options.map((week) => (
          <option key={week} value={week}>
            {week}
          </option>
        ))}
      </select>
    </label>
  )
}
