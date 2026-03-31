'use client'

import { useState, useTransition } from 'react'
import { PhoneInput } from '@/components/phone-input'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { previewTransfer, transferSubscription } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function TransferSubscriptionPage() {
  const [fromSub, setFromSub] = useState('')
  const [toSub, setToSub] = useState('')
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewTransfer>> | null>(null)
  const [result, setResult] = useState<{ ok: boolean; error?: string; details?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const handlePreview = () => {
    setResult(null)
    setPreview(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('from_phone', normalizeKZPhone(fromSub) ?? '')
      formData.set('to_phone', normalizeKZPhone(toSub) ?? '')
      const res = await previewTransfer(formData)
      setPreview(res)
    })
  }

  const handleTransfer = () => {
    setResult(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('from_phone', normalizeKZPhone(fromSub) ?? '')
      formData.set('to_phone', normalizeKZPhone(toSub) ?? '')
      const res = await transferSubscription(formData)
      setResult(res)
      if (res.ok) setPreview(null)
    })
  }

  const handleReset = () => {
    setFromSub('')
    setToSub('')
    setPreview(null)
    setResult(null)
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Перенос подписки</h1>
        <p className="mt-1 text-sm text-gray-500">
          Перенесите активную подписку с одного номера на другой.
        </p>
      </div>

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="from_phone" className="mb-1.5 block text-sm font-medium text-gray-700">
              С номера
            </label>
            <PhoneInput
              id="from_phone"
              subscriber={fromSub}
              onSubscriberChange={(s) => { setFromSub(s); setPreview(null); setResult(null) }}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="to_phone" className="mb-1.5 block text-sm font-medium text-gray-700">
              На номер
            </label>
            <PhoneInput
              id="to_phone"
              subscriber={toSub}
              onSubscriberChange={(s) => { setToSub(s); setPreview(null); setResult(null) }}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePreview}
            disabled={isPending || !normalizeKZPhone(fromSub) || !normalizeKZPhone(toSub)}
          >
            {isPending ? 'Загрузка...' : 'Предпросмотр'}
          </Button>
        </div>
      </Card>

      {preview && !preview.ok ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {preview.error}
        </div>
      ) : null}

      {preview?.ok ? (
        <Card className="mb-6">
          <h2 className="font-semibold">Предпросмотр</h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-400">С номера</p>
              <p className="mt-0.5 font-medium">{preview.fromPhone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">На номер</p>
              <p className="mt-0.5 font-medium">{preview.toPhone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">План</p>
              <p className="mt-0.5 font-medium">{preview.plan}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Срок</p>
              <p className="mt-0.5 font-medium">{preview.startDate} → {preview.endDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Получатель</p>
              <Badge color={preview.toUserExists ? 'green' : 'red'}>
                {preview.toUserExists ? 'Найден' : 'Не найден'}
              </Badge>
            </div>
          </div>

          {preview.toUserExists ? (
            <div className="mt-5 flex gap-2">
              <Button onClick={handleTransfer} disabled={isPending}>
                {isPending ? 'Переносим...' : 'Подтвердить'}
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                Отмена
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-500">
              Получатель должен сначала войти через WhatsApp.
            </p>
          )}
        </Card>
      ) : null}

      {result?.ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {result.details}
        </div>
      ) : null}

      {result && !result.ok ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      ) : null}
    </div>
  )
}
