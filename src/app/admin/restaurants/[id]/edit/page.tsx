import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { PhoneInput } from '@/components/phone-input'
import { updateRestaurant } from '../../actions'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminRestaurantEditPage({ params }: PageProps) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: r } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single()

  if (!r) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Редактировать</h1>
          <Link
            href={`/admin/restaurants/${r.id}/locations`}
            className="text-sm text-gray-600 underline"
          >
            Адреса
          </Link>
          <Link href="/admin/restaurants" className="text-sm text-gray-600 underline">Назад</Link>
        </div>

        <form action={updateRestaurant} className="mt-8 space-y-4">
          <input type="hidden" name="id" value={r.id} />
          <input name="restaurant_name" defaultValue={r.restaurant_name} required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="slug" defaultValue={r.slug} required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="address" defaultValue={r.address} required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="cuisine" defaultValue={r.cuisine} required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="cuisine_2" defaultValue={r.cuisine_2 ?? ''} placeholder="Кухня 2 (опционально)" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="cuisine_3" defaultValue={r.cuisine_3 ?? ''} placeholder="Кухня 3 (опционально)" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="short_description" defaultValue={r.short_description} required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="instagram_url" defaultValue={r.instagram_url ?? ''} className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="two_gis_url"  defaultValue={r.two_gis_url ?? ''} placeholder="2GIS URL (полная ссылка)" className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <PhoneInput name="phone" defaultValue={r.phone ?? ''} className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="photo_1_url" defaultValue={r.photo_1_url ?? ''} className="w-full rounded-2xl border px-4 py-3 text-sm" />

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={!!r.is_active} />
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