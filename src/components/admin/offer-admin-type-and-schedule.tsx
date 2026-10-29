'use client'

import { useState } from 'react'
import { Input, Select } from '@/components/ui/input'
import { OfferUsableHoursFields } from '@/components/admin/offer-usable-hours-fields'
import type { OfferUsableHour } from '@/lib/offers'

type Props = {
  defaultOfferType?: string
  defaultEndDate?: string
  initialHours?: OfferUsableHour[]
}

export function OfferAdminTypeAndSchedule({
  defaultOfferType = '2for1',
  defaultEndDate = '',
  initialHours = [],
}: Props) {
  const [offerType, setOfferType] = useState(defaultOfferType)
  const isKudafest = offerType === 'kudafest_set'

  return (
    <>
      <Select
        name="offer_type"
        label="Тип оффера"
        value={offerType}
        onChange={(event) => setOfferType(event.target.value)}
      >
        <option value="2for1">1+1</option>
        <option value="compliment">в подарок</option>
        <option value="kudafest_set">Сеты Kudafest</option>
      </Select>

      {isKudafest ? (
        <div
          className="space-y-4 rounded-xl border-2 border-violet-200 bg-violet-50/60 p-4"
          style={{ borderColor: '#C4B5FD' }}
        >
          <div>
            <p className="text-base font-semibold text-violet-950">Настройки Kudafest</p>
            <p className="mt-1 text-sm text-violet-800/80">
              Укажите дату окончания и часы, когда сет можно получить в ресторане.
            </p>
          </div>

          <Input
            name="end_date"
            type="date"
            label="Дата окончания"
            defaultValue={defaultEndDate}
            required
            hint="Обязательно для Kudafest."
          />

          <OfferUsableHoursFields initialHours={initialHours} />
        </div>
      ) : (
        <>
          <Input
            name="end_date"
            type="date"
            label="Дата окончания"
            defaultValue={defaultEndDate}
            hint="Необязательно для обычных офферов."
          />

          <details
            className="rounded-xl border border-gray-200 p-4"
            open={initialHours.some((h) => !h.is_unavailable)}
          >
            <summary className="cursor-pointer text-base font-medium text-gray-800">
              Часы действия (необязательно)
            </summary>
            <p className="mt-2 text-sm text-gray-500">
              Например, только будни 12:00–16:00. Пусто — оффер действует весь день.
            </p>
            <div className="mt-4">
              <OfferUsableHoursFields initialHours={initialHours} />
            </div>
          </details>
        </>
      )}
    </>
  )
}
