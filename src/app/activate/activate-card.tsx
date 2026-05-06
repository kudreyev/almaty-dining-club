'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { LogoutButton } from '@/components/logout-button'
import { activateAction, type ActivateActionResult } from './actions'

const WHATSAPP_SUPPORT_URL =
  'https://wa.me/77066059899?text=' +
  encodeURIComponent('Здравствуйте! Нужна помощь с активацией подписки Kudaclub')

type ActivateCardProps = {
  token: string
  phoneTarget: string
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'error'; reason: Exclude<ActivateActionResult, { ok: true }>['reason'] }

const ERROR_COPY: Record<
  Exclude<ActivateActionResult, { ok: true }>['reason'],
  { title: string; description: string }
> = {
  login_required: {
    title: 'Нужен вход',
    description: 'Сессия истекла. Войдите снова и попробуйте активацию ещё раз.',
  },
  invalid: {
    title: 'Ссылка недействительна',
    description: 'Проверьте ссылку или запросите новую у менеджера Kudaclub.',
  },
  revoked: {
    title: 'Ссылка отменена',
    description:
      'Эта ссылка была отменена. Напишите в WhatsApp — поможем оформить новую.',
  },
  expired: {
    title: 'Ссылка истекла',
    description:
      'Срок действия ссылки истёк. Напишите в WhatsApp — пришлём новую ссылку.',
  },
  already_used: {
    title: 'Ссылка уже использована',
    description: 'Подписка уже активирована. Если хотите продлить — напишите в WhatsApp.',
  },
  wrong_phone: {
    title: 'Нужен другой номер',
    description: 'Выйдите и войдите с номера, на который оформлена подписка.',
  },
  subscription_error: {
    title: 'Не удалось активировать',
    description:
      'Произошла ошибка при записи подписки. Попробуйте ещё раз или напишите в поддержку.',
  },
}

export function ActivateCard({ token, phoneTarget }: ActivateCardProps) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (status.kind !== 'success') return
    const id = window.setTimeout(() => {
      router.push('/app/me?activated=true')
    }, 2000)
    return () => window.clearTimeout(id)
  }, [status, router])

  function handleActivate() {
    setStatus({ kind: 'loading' })
    startTransition(async () => {
      const result = await activateAction(token)
      if (result.ok) {
        setStatus({ kind: 'success' })
        return
      }
      setStatus({ kind: 'error', reason: result.reason })
    })
  }

  if (status.kind === 'success') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Подписка активирована ✅</h1>
          <p className="mt-3 text-sm text-gray-600">
            Готово! Подписка активирована на 30 дней. Можно сразу выбирать заведения и офферы. Через пару секунд откроется личный кабинет — или перейдите сами.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Перейти к заведениям
            </Link>
            <Link
              href="/app/me?activated=true"
              className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Открыть кабинет
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (status.kind === 'error' && status.reason === 'wrong_phone') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Нужен другой номер</h1>
          <p className="mt-3 text-sm text-gray-600">
            Подписка оформлена на номер{' '}
            <span className="font-medium text-gray-900">{phoneTarget}</span>. Выйдите и войдите с нужного номера.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LogoutButton />
            <Link
              href="/"
              className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Перейти к заведениям
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (status.kind === 'error') {
    const copy = ERROR_COPY[status.reason]
    const isFatal =
      status.reason === 'subscription_error' || status.reason === 'invalid'
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div
          className={
            isFatal
              ? 'rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm'
              : 'rounded-3xl border border-gray-200 bg-white p-8 shadow-sm'
          }
        >
          <h1
            className={
              isFatal ? 'text-xl font-semibold text-red-900' : 'text-xl font-semibold'
            }
          >
            {copy.title}
          </h1>
          <p
            className={
              isFatal ? 'mt-3 text-sm text-red-800' : 'mt-3 text-sm text-gray-600'
            }
          >
            {copy.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleActivate}
              disabled={isPending}
              className="inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Попробовать снова
            </button>
            <a
              href={WHATSAPP_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Написать в WhatsApp
            </a>
          </div>
        </div>
      </main>
    )
  }

  const isLoading = status.kind === 'loading' || isPending

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Активация подписки Kudaclub</h1>
        <p className="mt-3 text-sm text-gray-600">
          Подписка активируется на номер{' '}
          <span className="font-medium text-gray-900">{phoneTarget}</span>. Срок действия — 30 дней.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleActivate}
            disabled={isLoading}
            className="inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Активируем...' : 'Активировать подписку'}
          </button>
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
          >
            Написать в WhatsApp
          </a>
        </div>
      </div>
    </main>
  )
}
