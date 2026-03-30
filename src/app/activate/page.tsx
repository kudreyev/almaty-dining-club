import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  completeActivation,
  getActivationLinkByToken,
  precheckActivationLink,
} from '@/lib/activation-links'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { LogoutButton } from '@/components/logout-button'
import { logAnalyticsEvent } from '@/lib/analytics'

const WHATSAPP_SUPPORT_URL =
  'https://wa.me/77066059899?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%9D%D1%83%D0%B6%D0%BD%D0%B0%20%D0%BF%D0%BE%D0%BC%D0%BE%D1%89%D1%8C%20%D1%81%20%D0%B0%D0%BA%D1%82%D0%B8%D0%B2%D0%B0%D1%86%D0%B8%D0%B5%D0%B9%20%D0%BF%D0%BE%D0%B4%D0%BF%D0%B8%D1%81%D0%BA%D0%B8%20KudaPass'

function normalizePhoneForQuery(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`
  if (digits.length === 10) return `+7${digits}`
  return cleaned
}

function loginRedirectWithNext(token: string, phoneTarget: string): never {
  const qs = new URLSearchParams()
  qs.set('token', token)
  const nextPath = `/activate?${qs.toString()}`
  const loginParams = new URLSearchParams()
  loginParams.set('next', nextPath)
  loginParams.set('phone', normalizePhoneForQuery(phoneTarget))
  redirect(`/login/whatsapp?${loginParams.toString()}`)
}

function CtaRow({ primaryHref, primaryText }: { primaryHref: string; primaryText: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        href={primaryHref}
        className="inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
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

  await logAnalyticsEvent({
    event_name: 'activation_opened',
    token: token.trim(),
  })

  const row = await getActivationLinkByToken(token.trim())
  if (!row) {
    await logAnalyticsEvent({
      event_name: 'activation_not_found',
      token: token.trim(),
    })
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка недействительна</h1>
          <p className="mt-3 text-sm text-gray-600">
            Проверьте ссылку или запросите новую у менеджера KudaPass.
          </p>
          <CtaRow primaryHref="/" primaryText="Перейти к заведениям" />
        </div>
      </main>
    )
  }

  // Re-log opened with resolved link info (helps funnel attribution).
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
              className="inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
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
    loginRedirectWithNext(token.trim(), row.phone_target)
  }

  const result = await completeActivation({
    userId: user.id,
    token: token.trim(),
  })

  if (result.ok) {
    await logAnalyticsEvent({
      event_name: 'activation_activated',
      activation_link_id: row.id,
      token: row.token,
      phone_target: row.phone_target,
      user_id: user.id,
    })
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Подписка активирована ✅</h1>
          <p className="mt-3 text-sm text-gray-600">
            Готово! Подписка активирована на 30 дней. Можно сразу выбирать заведения и офферы.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
            >
              Перейти к заведениям
            </Link>
            <Link
              href="/pricing"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Как это работает
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (result.reason === 'wrong_phone') {
    const userPhone =
      typeof user.user_metadata?.phone_e164 === 'string' ? user.user_metadata.phone_e164 : null
    await logAnalyticsEvent({
      event_name: 'activation_phone_mismatch',
      activation_link_id: row.id,
      token: row.token,
      phone_target: row.phone_target,
      user_id: user.id,
      meta: { userPhone },
    })
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Нужен другой номер</h1>
          <p className="mt-3 text-sm text-gray-600">
            Подписка оформлена на номер{' '}
            <span className="font-medium text-gray-900">{row.phone_target}</span>. Выйдите и войдите с нужного номера.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LogoutButton />
            <Link
              href="/"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Перейти к заведениям
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (result.reason === 'subscription_error') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-red-900">Не удалось активировать</h1>
          <p className="mt-3 text-sm text-red-800">
            Произошла ошибка при записи подписки. Попробуйте позже или напишите в поддержку.
          </p>
          <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white">
            На главную по подписке
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Не удалось обработать ссылку</h1>
        <p className="mt-3 text-sm text-gray-600">Попробуйте открыть ссылку ещё раз или обратитесь к менеджеру.</p>
        <CtaRow primaryHref="/" primaryText="Перейти к заведениям" />
      </div>
    </main>
  )
}
