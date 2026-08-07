'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const TITLE_MAX = 50
const BODY_MAX = 120

const URL_PRESETS = [
  { value: '/app/me', label: 'Кабинет (/app/me)' },
  { value: '/almaty', label: 'Алматы (/almaty)' },
  { value: '/astana', label: 'Астана (/astana)' },
  { value: 'custom', label: 'Своя ссылка' },
] as const

type Segment = 'all' | 'self'

type Meta = {
  endpoints: number
  subscribers: number
  selfEndpoints: number
  recentMassCount: number
}

type CampaignRow = {
  id: string
  title: string
  body: string
  url: string
  segment: Segment
  sent_count: number
  failed_count: number
  click_count: number
  created_at: string
}

async function runCampaignSend(args: {
  title: string
  body: string
  url: string
  segment: Segment
  onProgress: (p: { done: number; total: number; sent: number; failed: number }) => void
}): Promise<{ ok: true; campaignId: string } | { ok: false; error: string }> {
  const prepRes = await fetch('/api/admin/push/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url,
      segment: args.segment,
    }),
  })
  const prep = (await prepRes.json()) as {
    ok?: boolean
    campaignId?: string
    total?: number
    error?: string
  }
  if (!prepRes.ok || !prep.campaignId) {
    return { ok: false, error: prep.error ?? 'prepare_failed' }
  }

  let offset = 0
  let sent = 0
  let failed = 0
  const total = prep.total ?? 0
  args.onProgress({ done: 0, total, sent, failed })

  for (;;) {
    const batchRes = await fetch('/api/admin/push/send-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: prep.campaignId, offset }),
    })
    const batch = (await batchRes.json()) as {
      ok?: boolean
      nextOffset?: number
      done?: boolean
      total?: number
      sentCount?: number
      failedCount?: number
      processed?: number
      error?: string
    }
    if (!batchRes.ok || !batch.ok) {
      return { ok: false, error: batch.error ?? 'batch_failed' }
    }

    sent = batch.sentCount ?? sent
    failed = batch.failedCount ?? failed
    offset = batch.nextOffset ?? offset
    args.onProgress({
      done: Math.min(offset, batch.total ?? total),
      total: batch.total ?? total,
      sent,
      failed,
    })

    if (batch.done) break
  }

  return { ok: true, campaignId: prep.campaignId }
}

const ERROR_LABELS: Record<string, string> = {
  invalid_title: 'Проверьте заголовок (1–50 символов).',
  invalid_body: 'Проверьте текст (1–120 символов).',
  invalid_url: 'Некорректная ссылка.',
  no_self_subscription: 'У вас нет push-подписки. Включите пуши в кабинете на этом устройстве.',
  no_subscribers: 'Нет ни одной push-подписки.',
  prepare_failed: 'Не удалось создать кампанию.',
  batch_failed: 'Ошибка при отправке батча.',
}

export function PushAdminClient({
  initialCampaigns,
}: {
  initialCampaigns: CampaignRow[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [urlPreset, setUrlPreset] = useState<string>('/app/me')
  const [customUrl, setCustomUrl] = useState('/')
  const [segment, setSegment] = useState<Segment>('self')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [selfTestDone, setSelfTestDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    done: number
    total: number
    sent: number
    failed: number
  } | null>(null)

  const resolvedUrl = urlPreset === 'custom' ? customUrl.trim() || '/' : urlPreset

  const recipients = useMemo(() => {
    if (!meta) return 0
    return segment === 'self' ? meta.selfEndpoints : meta.endpoints
  }, [meta, segment])

  const loadMeta = useCallback(async () => {
    const res = await fetch('/api/admin/push/meta', { cache: 'no-store' })
    if (!res.ok) return
    const data = (await res.json()) as Meta
    setMeta(data)
  }, [])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  const onSend = async (target: Segment) => {
    setError(null)
    setStatus(null)

    if (target === 'all' && !selfTestDone) {
      setError('Сначала отправьте тест себе в этой сессии формы.')
      return
    }

    const count =
      target === 'self' ? (meta?.selfEndpoints ?? 0) : (meta?.endpoints ?? 0)

    let confirmMsg =
      target === 'self'
        ? `Отправить тест на ваши устройства (${count} endpoint)?`
        : `Отправить всем подписанным?\nПолучателей (endpoint): ${count}`

    if (target === 'all' && (meta?.recentMassCount ?? 0) >= 2) {
      confirmMsg +=
        '\n\n⚠ Не чаще 2 пушей в неделю — выжигает базу. За 7 дней уже было ≥2 массовых кампании.'
    }

    if (!window.confirm(confirmMsg)) return

    setBusy(true)
    setProgress({ done: 0, total: count, sent: 0, failed: 0 })

    const result = await runCampaignSend({
      title: title.trim(),
      body: body.trim(),
      url: resolvedUrl,
      segment: target,
      onProgress: setProgress,
    })

    setBusy(false)

    if (!result.ok) {
      setError(ERROR_LABELS[result.error] ?? result.error)
      return
    }

    if (target === 'self') {
      setSelfTestDone(true)
      setStatus('Тест отправлен. Теперь можно слать всем.')
    } else {
      setStatus('Массовая рассылка завершена.')
      setSelfTestDone(false)
    }

    await loadMeta()
    router.refresh()
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-neutral-700">
              Заголовок
              <span className="text-xs font-normal text-neutral-400">
                {title.length}/{TITLE_MAX}
              </span>
            </span>
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-[15px] outline-none focus:border-primary"
              placeholder="Пятница в kudaclub"
              disabled={busy}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-neutral-700">
              Текст
              <span className="text-xs font-normal text-neutral-400">
                {body.length}/{BODY_MAX}
              </span>
            </span>
            <textarea
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-[15px] outline-none focus:border-primary"
              placeholder="Куда сходить на выходных — свежая подборка"
              disabled={busy}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-700">
              Ссылка
            </span>
            <select
              value={urlPreset}
              onChange={(e) => setUrlPreset(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-primary"
              disabled={busy}
            >
              {URL_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {urlPreset === 'custom' ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">
                Свой path
              </span>
              <input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 font-mono text-[14px] outline-none focus:border-primary"
                placeholder="/r/slug"
                disabled={busy}
              />
            </label>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-neutral-700">Сегмент</legend>
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="radio"
                name="segment"
                checked={segment === 'self'}
                onChange={() => setSegment('self')}
                disabled={busy}
              />
              Только я (тест)
              {meta ? (
                <span className="text-neutral-400">· {meta.selfEndpoints} endpoint</span>
              ) : null}
            </label>
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="radio"
                name="segment"
                checked={segment === 'all'}
                onChange={() => setSegment('all')}
                disabled={busy}
              />
              Все с пушами
              {meta ? (
                <span className="text-neutral-400">
                  · {meta.subscribers} чел. / {meta.endpoints} endpoint
                </span>
              ) : null}
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={busy || !title.trim() || !body.trim()}
              onClick={() => void onSend('self')}
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
            >
              Отправить себе тест
            </button>
            <button
              type="button"
              disabled={busy || !selfTestDone || !title.trim() || !body.trim()}
              onClick={() => void onSend('all')}
              className="rounded-lg bg-primary px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
              title={
                selfTestDone
                  ? undefined
                  : 'Сначала отправьте тест себе'
              }
            >
              Отправить всем
            </button>
          </div>

          {!selfTestDone ? (
            <p className="text-[13px] text-neutral-500">
              «Отправить всем» откроется после успешного теста себе в этой сессии.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
              {status}
            </p>
          ) : null}

          {progress ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 text-[13px]">
              <div className="mb-1.5 flex justify-between text-neutral-600">
                <span>
                  Прогресс: {progress.done} / {progress.total}
                </span>
                <span>
                  ok {progress.sent} · err {progress.failed}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      progress.total > 0
                        ? `${Math.min(100, (progress.done / progress.total) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          ) : null}

          <p className="text-[12px] text-neutral-400">
            Получателей сейчас (сегмент): {recipients}
            {meta && meta.recentMassCount >= 2 ? (
              <>
                {' '}
                · за неделю mass-кампаний: {meta.recentMassCount}
              </>
            ) : null}
          </p>
        </div>

        {/* Preview */}
        <div>
          <p className="mb-3 text-sm font-medium text-neutral-700">Превью</p>
          <div className="mx-auto w-full max-w-[320px] rounded-[2rem] border border-neutral-300 bg-neutral-100 p-3 shadow-inner">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-[11px] font-semibold text-white">
                  kc
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-neutral-900">
                      kudaclub
                    </p>
                    <span className="shrink-0 text-[11px] text-neutral-400">сейчас</span>
                  </div>
                  <p className="mt-0.5 text-[13px] font-medium leading-snug text-neutral-900">
                    {title.trim() || 'Заголовок пуша'}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-neutral-600">
                    {body.trim() || 'Текст уведомления'}
                  </p>
                  <p className="mt-1.5 truncate font-mono text-[10px] text-neutral-400">
                    → {resolvedUrl}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">История</h2>
        {initialCampaigns.length === 0 ? (
          <p className="text-sm text-neutral-500">Пока нет кампаний.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Дата</th>
                  <th className="px-3 py-2.5 font-medium">Заголовок</th>
                  <th className="px-3 py-2.5 font-medium">Сегмент</th>
                  <th className="px-3 py-2.5 font-medium">Отправлено</th>
                  <th className="px-3 py-2.5 font-medium">Ошибок</th>
                  <th className="px-3 py-2.5 font-medium">Кликов</th>
                </tr>
              </thead>
              <tbody>
                {initialCampaigns.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100">
                    <td className="whitespace-nowrap px-3 py-2.5 text-neutral-600">
                      {new Date(c.created_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 font-medium text-neutral-900">
                      {c.title}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-600">
                      {c.segment === 'self' ? 'тест' : 'все'}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{c.sent_count}</td>
                    <td className="px-3 py-2.5 tabular-nums">{c.failed_count}</td>
                    <td className="px-3 py-2.5 tabular-nums">{c.click_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
