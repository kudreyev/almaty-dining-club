import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  completeActivation,
  getActivationLinkByToken,
  precheckActivationLink,
} from '@/lib/activation-links'

function loginRedirectWithNext(token: string): never {
  const qs = new URLSearchParams()
  qs.set('token', token)
  const nextPath = `/activate?${qs.toString()}`
  redirect(`/login/whatsapp?next=${encodeURIComponent(nextPath)}`)
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

  const row = await getActivationLinkByToken(token.trim())
  if (!row) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка недействительна</h1>
          <p className="mt-3 text-sm text-gray-600">
            Проверьте ссылку или запросите новую у менеджера KudaPass.
          </p>
          <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white">
            Подписка
          </Link>
        </div>
      </main>
    )
  }

  const pre = precheckActivationLink(row)
  if (pre.kind === 'revoked') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка отозвана</h1>
          <p className="mt-3 text-sm text-gray-600">Обратитесь в поддержку KudaPass.</p>
          <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white">
            Подписка
          </Link>
        </div>
      </main>
    )
  }
  if (pre.kind === 'expired') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Срок ссылки истёк</h1>
          <p className="mt-3 text-sm text-gray-600">Запросите у менеджера новую ссылку для активации.</p>
          <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white">
            Подписка
          </Link>
        </div>
      </main>
    )
  }
  if (pre.kind === 'already_used') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Ссылка уже использована</h1>
          <p className="mt-3 text-sm text-gray-600">Войдите в личный кабинет, чтобы проверить подписку.</p>
          <Link href="/app/me" className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white">
            Личный кабинет
          </Link>
        </div>
      </main>
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    loginRedirectWithNext(token.trim())
  }

  const result = await completeActivation({
    userId: user.id,
    token: token.trim(),
  })

  if (result.ok) {
    redirect('/app/me')
  }

  if (result.reason === 'wrong_phone') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Нужен другой номер</h1>
          <p className="mt-3 text-sm text-gray-600">
            Войдите в аккаунт с номером{' '}
            <span className="font-medium text-gray-900">{row.phone_target}</span>, указанным при оформлении.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Сейчас вы авторизованы под другим пользователем. Выйдите и войдите через WhatsApp с нужным номером.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
            >
              Войти снова
            </Link>
            <Link
              href="/app/me"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black"
            >
              Кабинет
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
        <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white">
          Подписка
        </Link>
      </div>
    </main>
  )
}
