import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { PhoneInput } from '@/components/phone-input'
import { createRestaurant } from '../actions'

export default async function AdminRestaurantNewPage() {
  await requireAdmin()

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Добавить ресторан</h1>
          <Link href="/admin/restaurants" className="text-sm text-gray-600 underline">Назад</Link>
        </div>

        <form action={createRestaurant} className="mt-8 space-y-4">
          <input name="restaurant_name" placeholder="Название" required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="slug" placeholder="slug (латиницей)" required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="address" placeholder="Адрес" required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="cuisine" placeholder="Кухня" required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="cuisine_2" placeholder="Кухня 2 (опционально)" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="cuisine_3" placeholder="Кухня 3 (опционально)" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="short_description" placeholder="Короткое описание (до 120)" required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="instagram_url" placeholder="Ссылка на Инстаграм" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="two_gis_url" placeholder="Ссылка на 2GIS (полная)" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <PhoneInput name="phone" placeholder="Телефон" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="photo_1_url" placeholder="Ссылка на фото 1" className="w-full rounded-2xl border px-4 py-3 text-sm" />

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="is_active" defaultChecked />
            Активен
          </label>

          <button className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white">
            Сохранить
          </button>
        </form>
      </div>
    </main>
  )
}