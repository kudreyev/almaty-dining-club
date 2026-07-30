import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { computePromoAmounts, type PromoCodeRow } from '@/lib/promo-codes'
import { PRICE_KZT, formatPriceKzt } from '@/lib/pricing'
import { createPromoCode, togglePromoActive } from './actions'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

type PromoListRow = PromoCodeRow & {
  created_at: string
  updated_at: string
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'Укажите код из букв, цифр, _ или -.',
  invalid_discount: 'Укажите корректную скидку (процент 1–100 или сумму > 0).',
  invalid_max_uses: 'Лимит использований — целое число ≥ 1, либо пусто.',
  invalid_expires: 'Некорректная дата окончания.',
  invalid_id: 'Некорректный идентификатор промокода.',
  duplicate: 'Такой промокод уже существует.',
}

const SUCCESS_MESSAGES: Record<string, string> = {
  '1': 'Промокод создан.',
  activated: 'Промокод включён.',
  deactivated: 'Промокод выключен.',
}

function formatDiscount(row: PromoListRow): string {
  if (row.discount_percent != null) return `−${Number(row.discount_percent)}%`
  if (row.fixed_amount != null) return `−${formatPriceKzt(Number(row.fixed_amount))}`
  return '—'
}

function formatUses(row: PromoListRow): string {
  if (row.max_uses == null) return `${row.used_count} / ∞`
  return `${row.used_count} / ${row.max_uses}`
}

function isExpired(row: PromoListRow): boolean {
  return Boolean(row.expires_at && new Date(row.expires_at).getTime() < Date.now())
}

function isExhausted(row: PromoListRow): boolean {
  return row.max_uses != null && row.used_count >= row.max_uses
}

export default async function AdminPromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    created?: string
    updated?: string
  }>
}) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()

  const { error: errorParam, created: createdParam, updated: updatedParam } =
    await searchParams

  const { data: rows, error } = await supabase
    .from('promo_codes')
    .select(
      'id, code, discount_percent, fixed_amount, applies_to, max_uses, used_count, expires_at, campaign_tag, is_active, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<PromoListRow[]>()

  if (error) throw new Error(error.message)

  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] ?? errorParam : null
  const successMessage =
    (createdParam && SUCCESS_MESSAGES[createdParam]) ||
    (updatedParam && SUCCESS_MESSAGES[updatedParam]) ||
    null

  const preview50 = computePromoAmounts(PRICE_KZT, {
    discount_percent: 50,
    fixed_amount: null,
    applies_to: 'first_month',
  })

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Промокоды
        </h1>
        <p className="mt-1 text-base leading-6 text-gray-500">
          Скидки на чекаут kudaclub. Базовая цена {formatPriceKzt(PRICE_KZT)}.
          Пример −50% на первый месяц: {formatPriceKzt(preview50.first_amount)},
          далее {formatPriceKzt(preview50.recurrent_amount)}/мес. Счётчик
          использований растёт только после успешной оплаты.
        </p>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <Card className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Создать промокод</h2>
        <form action={createPromoCode} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="code"
              className="mb-1.5 block text-base font-medium text-gray-700"
            >
              Код
            </label>
            <input
              id="code"
              name="code"
              required
              placeholder="HALF50"
              autoComplete="off"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base uppercase outline-none transition-colors focus:border-accent"
            />
          </div>

          <div>
            <label
              htmlFor="discount_type"
              className="mb-1.5 block text-base font-medium text-gray-700"
            >
              Тип скидки
            </label>
            <select
              id="discount_type"
              name="discount_type"
              defaultValue="percent"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-accent"
            >
              <option value="percent">Процент (%)</option>
              <option value="fixed">Фиксированная сумма (₸)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="discount_value"
              className="mb-1.5 block text-base font-medium text-gray-700"
            >
              Значение
            </label>
            <input
              id="discount_value"
              name="discount_value"
              type="number"
              required
              min={1}
              step="any"
              defaultValue={50}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
            />
            <p className="mt-1 text-sm text-gray-400">
              Для процента — 1–100. Для суммы — сколько тенге снять с цены.
            </p>
          </div>

          <div>
            <label
              htmlFor="applies_to"
              className="mb-1.5 block text-base font-medium text-gray-700"
            >
              Действует
            </label>
            <select
              id="applies_to"
              name="applies_to"
              defaultValue="first_month"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-accent"
            >
              <option value="first_month">Только первый месяц</option>
              <option value="forever">Навсегда (и рекуррент)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="max_uses"
              className="mb-1.5 block text-base font-medium text-gray-700"
            >
              Лимит использований
            </label>
            <input
              id="max_uses"
              name="max_uses"
              type="number"
              min={1}
              placeholder="Без лимита"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
            />
          </div>

          <div>
            <label
              htmlFor="expires_at"
              className="mb-1.5 block text-base font-medium text-gray-700"
            >
              Истекает
            </label>
            <input
              id="expires_at"
              name="expires_at"
              type="datetime-local"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
            />
          </div>

          <div>
            <label
              htmlFor="campaign_tag"
              className="mb-1.5 block text-base font-medium text-gray-700"
            >
              Тег кампании
            </label>
            <input
              id="campaign_tag"
              name="campaign_tag"
              placeholder="launch_half"
              maxLength={128}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" size="lg">
              Создать промокод
            </Button>
          </div>
        </form>
      </Card>

      {!rows?.length ? (
        <EmptyState
          title="Пока нет промокодов"
          description="Создайте первый промокод формой выше."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-base">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Код
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Скидка
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Срок
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Использования
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Истекает
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Кампания
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const amounts = computePromoAmounts(PRICE_KZT, row)
                  const expired = isExpired(row)
                  const exhausted = isExhausted(row)
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3 font-medium tracking-wide">
                        {row.code}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{formatDiscount(row)}</div>
                        <div className="text-sm text-gray-400">
                          → {formatPriceKzt(amounts.first_amount)}
                          {row.applies_to === 'first_month'
                            ? `, далее ${formatPriceKzt(amounts.recurrent_amount)}`
                            : '/мес'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          color={
                            row.applies_to === 'forever' ? 'accent' : 'default'
                          }
                        >
                          {row.applies_to === 'forever'
                            ? 'Навсегда'
                            : '1-й месяц'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatUses(row)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {row.expires_at
                          ? new Date(row.expires_at).toLocaleString('ru-RU')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {row.campaign_tag ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {!row.is_active ? (
                          <Badge color="default">Выкл</Badge>
                        ) : expired ? (
                          <Badge color="yellow">Истёк</Badge>
                        ) : exhausted ? (
                          <Badge color="yellow">Исчерпан</Badge>
                        ) : (
                          <Badge color="green">Активен</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <form action={togglePromoActive}>
                          <input type="hidden" name="id" value={row.id} />
                          <input
                            type="hidden"
                            name="is_active"
                            value={row.is_active ? 'false' : 'true'}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={row.is_active ? 'secondary' : 'primary'}
                          >
                            {row.is_active ? 'Выключить' : 'Включить'}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
