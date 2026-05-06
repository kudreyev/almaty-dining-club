import { requireAdmin } from '@/lib/admin'
import { importCsvText } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function describeImportError(errorKey: string, slug?: string) {
  const code = errorKey.split(':')[0] ?? errorKey
  const labels: Record<string, string> = {
    empty_csv: 'Файл пуст.',
    no_headers: 'Не найдена строка заголовков.',
    no_rows: 'Нет строк данных.',
    restaurant_upsert_failed: 'Не удалось сохранить заведение (проверьте строку в CSV).',
    missing_offer_key_for_slug: 'Не указан offer_key для строки.',
    missing_offer_key: 'Не указан offer_key для строки.',
    offer_upsert_failed: 'Не удалось сохранить оффер.',
    staff_update_failed: 'Не удалось обновить персонал.',
    staff_insert_failed: 'Не удалось создать запись персонала.',
  }
  const base = labels[code] ?? 'Ошибка импорта.'
  if (code === 'missing_offer_key_for_slug' || code === 'missing_offer_key') {
    return slug ? `${base} Slug: ${slug}.` : base
  }
  return base
}

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string; slug?: string }>
}

export default async function AdminImportPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { ok, error, slug } = await searchParams

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Импорт CSV</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">
          Вставьте CSV с заголовками — создадим или обновим заведения, офферы и PIN.
        </p>
      </div>

      {ok ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">
          Импорт завершён: {ok}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          {describeImportError(error, slug)}
        </div>
      ) : null}

      <Card className="mb-6">
        <p className="text-base font-medium">Формат CSV</p>
        <p className="mt-2 text-base leading-6 text-gray-500">
          Первая строка — заголовки. Разделитель — запятая. Текст можно брать в кавычки.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Обязательные поля: <code className="rounded bg-gray-100 px-1">restaurant_name</code>, <code className="rounded bg-gray-100 px-1">slug</code>, <code className="rounded bg-gray-100 px-1">district</code>, <code className="rounded bg-gray-100 px-1">address</code>, <code className="rounded bg-gray-100 px-1">cuisine</code>, <code className="rounded bg-gray-100 px-1">offer_type</code>, <code className="rounded bg-gray-100 px-1">offer_title</code>, <code className="rounded bg-gray-100 px-1">staff_pin</code>
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Опционально для офферов: <code className="rounded bg-gray-100 px-1">estimated_value</code>, <code className="rounded bg-gray-100 px-1">cooldown_days</code>.
          Старые поля времени/дней/stackable можно не передавать. Колонка <code className="rounded bg-gray-100 px-1">offer_terms_full</code>, если есть в файле, не используется.
        </p>
      </Card>

      <Card>
        <form action={importCsvText} className="space-y-4">
          <textarea
            name="csv"
            rows={12}
            placeholder="Вставьте CSV с заголовками..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors placeholder:text-gray-500 focus:border-accent"
            required
          />
          <Button type="submit" className="w-full">
            Импортировать CSV
          </Button>
        </form>
      </Card>
    </div>
  )
}
