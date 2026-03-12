import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { updateOffer } from '../../../actions'

type PageProps = { params: Promise<{ restaurantId: string; offerId: string }> }

export default async function AdminOfferEditPage({ params }: PageProps) {
  const { restaurantId, offerId } = await params
  const { supabase } = await requireAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .single()

  const { data: offer } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!offer) notFound()

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Редактировать оффер</h1>
          <Link href={`/admin/offers/${restaurantId}`} className="text-sm text-gray-600 underline">
            Назад
          </Link>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          {restaurant?.restaurant_name}
        </p>

        <form action={updateOffer} className="mt-8 space-y-4">
          <input type="hidden" name="id" value={offer.id} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />

          <select name="offer_type" defaultValue={offer.offer_type} className="w-full rounded-2xl border px-4 py-3 text-sm">
            <option value="2for1">2for1 (1+1)</option>
            <option value="compliment">compliment (Комплимент)</option>
          </select>

          <input name="offer_title" defaultValue={offer.offer_title} required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <input name="offer_terms_short" defaultValue={offer.offer_terms_short} required className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <textarea name="offer_terms_full" defaultValue={offer.offer_terms_full} rows={5} required className="w-full rounded-2xl border px-4 py-3 text-sm" />

          <input name="offer_days" defaultValue={offer.offer_days} className="w-full rounded-2xl border px-4 py-3 text-sm" />
          <div className="grid gap-4 sm:grid-cols-2">
            <input name="offer_time_from" defaultValue={String(offer.offer_time_from).slice(0,5)} className="w-full rounded-2xl border px-4 py-3 text-sm" />
            <input name="offer_time_to" defaultValue={String(offer.offer_time_to).slice(0,5)} className="w-full rounded-2xl border px-4 py-3 text-sm" />
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="requires_main_course" defaultChecked={!!offer.requires_main_course} />
            Требует основное блюдо
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="is_stackable_with_other_promos" defaultChecked={!!offer.is_stackable_with_other_promos} />
            Суммируется с другими акциями
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={!!offer.is_active} />
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