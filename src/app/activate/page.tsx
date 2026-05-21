import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getActivationLinkByToken,
  precheckActivationLink,
} from '@/lib/activation-links'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAnalyticsEvent } from '@/lib/analytics'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { ActivateCard } from './activate-card'

const WHATSAPP_SUPPORT_URL =
  'https://wa.me/77066059899?text=' +
  encodeURIComponent('Здравствуйте! Нужна помощь с активацией подписки Kudaclub')

function loginRedirectWithNext(token: string, phoneTarget: string): never {
  const qs = new URLSearchParams()
  qs.set('token', token)
  const nextPath = `/activate?${qs.toString()}`
  const loginParams = new URLSearchParams()
  loginParams.set('next', nextPath)
  loginParams.set('phone', normalizeKZPhone(phoneTarget) ?? phoneTarget)
  // Активационный токен пробрасывается в форму логина как сигнал разрешения
  // создавать новый auth-аккаунт. На сервере токен перепроверяется по БД и
  // сверяется phone_target с поданным номером — URL-параметру не доверяем.
  loginParams.set('activation_token', token)
  redirect(`/login/whatsapp?${loginParams.toString()}`)
}

function CtaRow({ primaryHref, primaryText }: { primaryHref: string; primaryText: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        href={primaryHref}
        className="inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white"
      >
        {primaryText}
      </Link>
      <a
        href={WHATSAPP_SUPPORT_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black"
      >
        Написать в WhatsApp
      </a>
    </div>
  )
}

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token || typeof token !== 'string' || !token.trim()) {
    redirect('/pricing')
  }

  const trimmedToken = token.trim()

  const row = await getActivationLinkByToken(trimmedToken)
  if (!row) {
    await logAnalyticsEvent({
      event_name: 'activation_opened',
      token: trimmedToken,
    })
    await logAnalyticsEvent({
      event_name: 'activation_not_found',
      token: trimmedToken,
    })
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка недействительна</h1>
          <p className="mt-3 text-sm text-gray-600">
            Проверьте ссылку или запросите новую у менеджера Kudaclub.
          </p>
          <CtaRow primaryHref="/" primaryText="Перейти к заведениям" />
        </div>
      </main>
    )
  }

  await logAnalyticsEvent({
    event_name: 'activation_opened',
    activation_link_id: row.id,
    token: row.token,
    phone_target: row.phone_target,
  })

  const pre = precheckActivationLink(row)
  if (pre.kind === 'revoked') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка отменена</h1>
          <p className="mt-3 text-sm text-gray-600">
            Эта ссылка была отменена. Напишите в WhatsApp — поможем оформить новую.
          </p>
          <CtaRow primaryHref="/" primaryText="Перейти к заведениям" />
        </div>
      </main>
    )
  }
  if (pre.kind === 'expired') {
    // Idempotently mark as expired if it wasn't activated/revoked.
    if (row.status !== 'activated' && row.status !== 'revoked') {
      try {
        const admin = createSupabaseAdminClient()
        await admin
          .from('activation_links')
          .update({ status: 'expired' })
          .eq('id', row.id)
          .not('status', 'in', '("activated","revoked")')
      } catch {
        // Best-effort: activation page UX should still work if DB update fails.
      }
    }
    await logAnalyticsEvent({
      event_name: 'activation_expired',
      activation_link_id: row.id,
      token: row.token,
      phone_target: row.phone_target,
    })
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка истекла</h1>
          <p className="mt-3 text-sm text-gray-600">
            Срок действия ссылки истёк. Напишите в WhatsApp — мы пришлём новую ссылку для активации.
          </p>
          <CtaRow primaryHref="/" primaryText="Перейти к заведениям" />
        </div>
      </main>
    )
  }
  if (pre.kind === 'already_used') {
    await logAnalyticsEvent({
      event_name: 'activation_already_activated',
      activation_link_id: row.id,
      token: row.token,
      phone_target: row.phone_target,
    })
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка уже использована ✅</h1>
          <p className="mt-3 text-sm text-gray-600">
            Подписка уже активирована. Если вы хотите продлить — напишите в WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white"
            >
              Перейти к заведениям
            </Link>
            <Link
              href="/app/me"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Открыть кабинет
            </Link>
            <a
              href={WHATSAPP_SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Написать в WhatsApp
            </a>
          </div>
        </div>
      </main>
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    await logAnalyticsEvent({
      event_name: 'activation_login_required',
      activation_link_id: row.id,
      token: row.token,
      phone_target: row.phone_target,
    })
    loginRedirectWithNext(trimmedToken, row.phone_target)
  }

  return (
    <ActivateCard
      token={trimmedToken}
      phoneTarget={row.phone_target}
      linkKind={row.kind === 'trial' ? 'trial' : 'paid'}
      trialDays={row.trial_days}
    />
  )
}
