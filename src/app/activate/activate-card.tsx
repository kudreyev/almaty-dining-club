'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogoutButton } from '@/components/logout-button'
import { WhatsappSupportLink } from '@/components/analytics/whatsapp-support-link'
import { activateAction, type ActivateActionResult } from './actions'

const WHATSAPP_SUPPORT_URL =
  'https://wa.me/77066059899?text=' +
  encodeURIComponent('Здравствуйте! Нужна помощь с активацией подписки Kudaclub')

type ActivateCardProps = {
  token: string
  phoneTarget: string
  linkKind: 'paid' | 'trial'
  trialDays?: number | null
}

type Status =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; purchaseEventId: string; trialEventId: string; kind: 'paid' | 'trial' }
  | { state: 'error'; reason: Exclude<ActivateActionResult, { ok: true }>['reason'] }

function buildMeActivatedHref(args: {
  kind: 'paid' | 'trial'
  purchaseEventId: string
  trialEventId: string
}): string {
  const query = new URLSearchParams({
    activated: 'true',
    activation_kind: args.kind,
  })
  if (args.kind === 'paid') {
    query.set('purchase_event_id', args.purchaseEventId)
  } else {
    query.set('trial_event_id', args.trialEventId)
  }
  return `/app/me?${query.toString()}`
}

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
    description: 'Проверьте ссылку или оформите подписку картой на странице тарифа.',
  },
  revoked: {
    title: 'Ссылка отменена',
    description:
      'Эта ссылка больше недействительна. Оформить подписку можно картой на странице тарифа.',
  },
  expired: {
    title: 'Ссылка истекла',
    description:
      'Срок действия ссылки истёк. Оформить подписку можно картой на странице тарифа.',
  },
  already_used: {
    title: 'Ссылка уже использована',
    description: 'Подписка уже активирована. Продлить подписку можно картой на странице тарифа.',
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
  trial_already_used: {
    title: 'Пробный доступ уже использован',
    description:
      'На этот номер уже выдавался пробный доступ. Чтобы продолжить — оформите платную подписку.',
  },
  not_customer: {
    title: 'Внутренний доступ',
    description:
      'Этот аккаунт помечен как стафф/тест. Активация по ссылке недоступна — доступ выдаётся админом.',
  },
}

export function ActivateCard({ token, phoneTarget, linkKind, trialDays }: ActivateCardProps) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [isLoading, setIsLoading] = useState(false)
  const trialDuration = trialDays && trialDays > 0 ? trialDays : 14

  useEffect(() => {
    if (status.state !== 'success') return
    const id = window.setTimeout(() => {
      router.push(
        buildMeActivatedHref({
          kind: status.kind,
          purchaseEventId: status.purchaseEventId,
          trialEventId: status.trialEventId,
        }),
      )
    }, 2000)
    return () => window.clearTimeout(id)
  }, [status, router])

  async function handleActivate() {
    setIsLoading(true)
    setStatus({ state: 'loading' })
    try {
      const result = await activateAction(token)
      if (result.ok) {
        setStatus({
          state: 'success',
          purchaseEventId: result.purchaseEventId,
          trialEventId: result.trialEventId,
          kind: result.kind,
        })
      } else {
        setStatus({ state: 'error', reason: result.reason })
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (status.state === 'success') {
    const isTrial = status.kind === 'trial'
    const title = isTrial
      ? `Пробный доступ активирован на ${trialDuration} дней ✅`
      : 'Подписка активирована ✅'
    const description = isTrial
      ? `Готово! Пробный доступ открыт на ${trialDuration} дней. Можно сразу выбирать заведения и офферы. Через пару секунд откроется личный кабинет — или перейдите сами.`
      : 'Готово! Подписка активирована на 30 дней. Можно сразу выбирать заведения и офферы. Через пару секунд откроется личный кабинет — или перейдите сами.'

    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-gray-600">{description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Перейти к заведениям
            </Link>
            <Link
              href={buildMeActivatedHref({
                kind: status.kind,
                purchaseEventId: status.purchaseEventId,
                trialEventId: status.trialEventId,
              })}
              className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Открыть кабинет
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (status.state === 'error' && status.reason === 'wrong_phone') {
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

  if (status.state === 'error') {
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
              onClick={() => void handleActivate()}
              disabled={isLoading}
              className="inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Попробовать снова
            </button>
            <WhatsappSupportLink
              source="activate-card-error"
              href={WHATSAPP_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Написать в WhatsApp
            </WhatsappSupportLink>
          </div>
        </div>
      </main>
    )
  }

  const isTrialIntro = linkKind === 'trial'
  const introTitle = isTrialIntro
    ? `Пробный доступ Kudaclub на ${trialDuration} дней`
    : 'Активация подписки Kudaclub'
  const introDescription = isTrialIntro
    ? `Пробный доступ откроется на номер ${phoneTarget} и будет активен ${trialDuration} дней. Пробный доступ выдаётся 1 раз на номер.`
    : null

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{introTitle}</h1>
        {isTrialIntro ? (
          <p className="mt-3 text-sm text-gray-600">{introDescription}</p>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            Подписка активируется на номер{' '}
            <span className="font-medium text-gray-900">{phoneTarget}</span>. Срок действия — 30 дней.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleActivate()}
            disabled={isLoading}
            className="inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? 'Активируем...'
              : isTrialIntro
                ? 'Активировать пробный доступ'
                : 'Активировать подписку'}
          </button>
          <WhatsappSupportLink
            source="activate-card-intro"
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
          >
            Написать в WhatsApp
          </WhatsappSupportLink>
        </div>
      </div>
    </main>
  )
}
