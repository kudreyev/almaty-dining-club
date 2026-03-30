'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { PhoneInput } from '@/components/phone-input'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { previewTransfer, transferSubscription } from './actions'

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
      if (res.ok) {
        setPreview(null)
      }
    })
  }

  const handleReset = () => {
    setFromSub('')
    setToSub('')
    setPreview(null)
    setResult(null)
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Админка · Перенос подписки</h1>
            <p className="mt-2 text-sm text-gray-600">
              Перенесите активную подписку с одного номера на другой.
            </p>
          </div>
          <Link
            href="/admin/activation-links"
            className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Активации
          </Link>
        </div>

        <div className="mt-8 grid gap-4 rounded-2xl border border-gray-200 p-6 md:grid-cols-[1fr_1fr]">
          <div>
            <label htmlFor="from_phone" className="mb-2 block text-sm font-medium text-gray-700">
              С номера (текущий владелец)
            </label>
            <PhoneInput
              id="from_phone"
              subscriber={fromSub}
              onSubscriberChange={(s) => {
                setFromSub(s)
                setPreview(null)
                setResult(null)
              }}
            />
          </div>
          <div>
            <label htmlFor="to_phone" className="mb-2 block text-sm font-medium text-gray-700">
              На номер (новый владелец)
            </label>
            <PhoneInput
              id="to_phone"
              subscriber={toSub}
              onSubscriberChange={(s) => {
                setToSub(s)
                setPreview(null)
                setResult(null)
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPending || !normalizeKZPhone(fromSub) || !normalizeKZPhone(toSub)}
            className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-black disabled:opacity-50"
          >
            {isPending ? 'Загрузка...' : 'Предпросмотр'}
          </button>
        </div>

        {preview && !preview.ok ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            {preview.error}
          </div>
        ) : null}

        {preview && preview.ok ? (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold">Предпросмотр переноса</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-gray-500">С номера</p>
                <p className="mt-1 font-medium">{preview.fromPhone}</p>
              </div>
              <div>
                <p className="text-gray-500">На номер</p>
                <p className="mt-1 font-medium">{preview.toPhone}</p>
              </div>
              <div>
                <p className="text-gray-500">План</p>
                <p className="mt-1 font-medium">{preview.plan}</p>
              </div>
              <div>
                <p className="text-gray-500">Срок</p>
                <p className="mt-1 font-medium">
                  {preview.startDate} → {preview.endDate}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Получатель в системе</p>
                <p className="mt-1 font-medium">
                  {preview.toUserExists ? (
                    <span className="text-green-700">Найден</span>
                  ) : (
                    <span className="text-red-700">Не найден — нужно сначала войти через WhatsApp</span>
                  )}
                </p>
              </div>
            </div>

            {preview.toUserExists ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={isPending}
                  className="rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isPending ? 'Переносим...' : 'Подтвердить перенос'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-black"
                >
                  Отмена
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {result && result.ok ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
            {result.details}
          </div>
        ) : null}

        {result && !result.ok ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            {result.error}
          </div>
        ) : null}
      </div>
    </main>
  )
}
