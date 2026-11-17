'use client'

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
  const offerType = defaultOfferType === 'set' ? '2for1' : defaultOfferType

  return (
    <>
      <Select
        name="offer_type"
        label="Тип оффера"
        defaultValue={offerType}
      >
        <option value="2for1">1+1</option>
        <option value="compliment">в подарок</option>
      </Select>

      <p className="text-xs text-neutral-500">
        Сеты фестиваля создаются в разделе «Фестивали», не здесь.
      </p>

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
  )
}
