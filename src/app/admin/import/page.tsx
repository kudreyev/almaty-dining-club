import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { importCsvText } from './actions'

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>
}

export default async function AdminImportPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { ok, error } = await searchParams

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Админка · Импорт CSV</h1>
            <p className="mt-2 text-sm text-gray-600">
              Вставьте CSV с заголовками — создадим или обновим заведения, офферы и PIN персонала.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/restaurants" className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black">
              Заведения
            </Link>
            <Link href="/admin/offers" className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black">
              Офферы
            </Link>
            <Link href="/admin/staff" className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black">
              PIN персонала
            </Link>
          </div>
        </div>

        {ok ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Импорт завершён: {ok}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Ошибка: {error}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl bg-gray-50 p-5 text-sm text-gray-700">
          <p className="font-medium">Формат CSV</p>
          <p className="mt-2">
            Первая строка — заголовки. Разделитель — запятая. Текст можно брать в кавычки.
          </p>
          <p className="mt-2">
            Минимально обязательные поля: <code>restaurant_name</code>, <code>slug</code>, <code>district</code>, <code>address</code>, <code>cuisine</code>, <code>short_description</code>, <code>two_gis_url</code>,
            <code>price_level</code>, <code>offer_type</code>, <code>offer_title</code>, <code>offer_terms_short</code>, <code>offer_terms_full</code>, <code>offer_days</code>,
            <code>offer_time_from</code>, <code>offer_time_to</code>, <code>staff_pin</code>.
          </p>
        </div>

        <form action={importCsvText} className="mt-8 space-y-4">
          <textarea
            name="csv"
            rows={16}
            placeholder="Вставь сюда CSV с заголовками..."
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            required
          />

          <button className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white">
            Импортировать CSV
          </button>
        </form>

        <div className="mt-10 text-sm text-gray-600">
          <p className="font-medium">Пример (можно скопировать и проверить):</p>
          <pre className="mt-3 overflow-auto rounded-2xl bg-gray-100 p-4 text-xs">
{`restaurant_name,slug,city,district,address,phone,instagram_url,website_url,two_gis_url,cuisine,short_description,price_level,photo_1_url,photo_2_url,photo_3_url,offer_type,offer_title,offer_terms_short,offer_terms_full,offer_days,offer_time_from,offer_time_to,requires_main_course,is_stackable_with_other_promos,is_active,staff_pin,staff_name,notes_internal
Aurora Pasta House,aurora-pasta-house,almaty,Bostandyk,пр. Абая 120,,https://instagram.com/aurora.pasta,,,Italian,"Паста и уютные ужины",mid,,,,2for1,"1+1 на пасту","Купи 1 пасту — вторая бесплатно","Действует на пасты из списка. Второе такое же или дешевле. Только dine-in.",Mon,Tue,Wed,Thu,Sun,12:00,21:00,false,false,true,1111,Администратор,""`
          }</pre>
        </div>
      </div>
    </main>
  )
}