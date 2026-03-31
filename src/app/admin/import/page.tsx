import { requireAdmin } from '@/lib/admin'
import { importCsvText } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>
}

export default async function AdminImportPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { ok, error } = await searchParams

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Импорт CSV</h1>
        <p className="mt-1 text-sm text-gray-500">
          Вставьте CSV с заголовками — создадим или обновим заведения, офферы и PIN.
        </p>
      </div>

      {ok ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Импорт завершён: {ok}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Ошибка: {error}
        </div>
      ) : null}

      <Card className="mb-6">
        <p className="text-sm font-medium">Формат CSV</p>
        <p className="mt-2 text-sm text-gray-500">
          Первая строка — заголовки. Разделитель — запятая. Текст можно брать в кавычки.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Обязательные поля: <code className="rounded bg-gray-100 px-1">restaurant_name</code>, <code className="rounded bg-gray-100 px-1">slug</code>, <code className="rounded bg-gray-100 px-1">district</code>, <code className="rounded bg-gray-100 px-1">address</code>, <code className="rounded bg-gray-100 px-1">cuisine</code>, <code className="rounded bg-gray-100 px-1">short_description</code>, <code className="rounded bg-gray-100 px-1">offer_type</code>, <code className="rounded bg-gray-100 px-1">offer_title</code>, <code className="rounded bg-gray-100 px-1">staff_pin</code>
        </p>
      </Card>

      <Card>
        <form action={importCsvText} className="space-y-4">
          <textarea
            name="csv"
            rows={12}
            placeholder="Вставьте CSV с заголовками..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-accent"
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
