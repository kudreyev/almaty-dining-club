'use client'

import { useState, useTransition } from 'react'
import { PhoneInput } from '@/components/phone-input'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { Button } from '@/components/ui/button'
import { markStaffByPhone } from './actions'

export function MarkStaffForm() {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    setMessage(null)
    const normalized = normalizeKZPhone(phone)
    if (!normalized) {
      setMessage('Некорректный номер.')
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set('phone', normalized)
      const res = await markStaffByPhone(formData)
      setMessage(res.ok ? `Отмечено профилей: ${res.marked ?? 1}` : (res.error ?? 'Ошибка'))
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor="staff_phone" className="mb-1.5 block text-sm font-medium text-gray-700">
          Номер стаффа (E.164)
        </label>
        <PhoneInput
          id="staff_phone"
          subscriber={phone}
          onSubscriberChange={setPhone}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
        />
      </div>
      <Button type="button" onClick={handleSubmit} disabled={isPending}>
        {isPending ? '…' : 'Сделать стаффом'}
      </Button>
      {message ? <p className="text-sm text-gray-600 sm:basis-full">{message}</p> : null}
    </div>
  )
}
