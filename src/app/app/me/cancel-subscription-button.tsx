'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cancelMySubscription } from './actions'

type Props = {
  /** Дата, до которой сохранится доступ (end_date), для подсказки пользователю. */
  paidUntil: string | null
}

export function CancelSubscriptionButton({ paidUntil }: Props) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paidUntilLabel = paidUntil
    ? new Date(paidUntil).toLocaleDateString('ru-RU')
    : null

  if (done) {
    return (
      <p className="mt-3 text-sm text-gray-600">
        Подписка отменена. Автосписаний больше не будет.
        {paidUntilLabel ? ` Доступ сохранится до ${paidUntilLabel}.` : ''}
      </p>
    )
  }

  const handleCancel = () => {
    setError(null)
    startTransition(async () => {
      const result = await cancelMySubscription()
      if (result.ok) {
        setDone(true)
      } else {
        setError(result.error ?? 'Не удалось отменить подписку.')
        setConfirming(false)
      }
    })
  }

  if (!confirming) {
    return (
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
          className="px-0 text-gray-500 hover:text-red-600"
        >
          Отменить подписку
        </Button>
        {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="mt-3">
      <p className="mb-2 text-sm text-gray-600">
        Отменить подписку и автосписания?
        {paidUntilLabel ? ` Доступ сохранится до ${paidUntilLabel}.` : ''}
      </p>
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={handleCancel}
          disabled={pending}
        >
          {pending ? 'Отменяем…' : 'Да, отменить'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Оставить
        </Button>
      </div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
